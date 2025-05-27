const fs = require('fs');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_KEY);

const PDFDocument = require('pdfkit');

const Product = require('../models/product');
const Order = require('../models/order');

const { fetchAllItems, forwardError } = require('../utils');

exports.getIndex = (req, res, next) => {
  fetchAllItems('shop/index', 'My Shop', '/', req, res, next);
};

exports.getProducts = (req, res, next) => {
  fetchAllItems(
    'shop/product-list',
    'Available Items',
    '/products',
    req,
    res,
    next
  );
};

exports.getProduct = (req, res, next) => {
  Product.findById(req.params.productId)
    .then((item) => {
      res.render('shop/product-detail', {
        title: item.title,
        path: '/products',
        item
      });
    }).catch(err => forwardError(err, next));
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.products.productId')
    .execPopulate()
    .then((user) => {
      const items = user.cart.products;
      res.render('shop/cart', {
        title: 'Your Shopping Cart',
        path: '/cart',
        items
      });
    }).catch(err => forwardError(err, next));
};

exports.postCart = (req, res, next) => {
  Product.findById(req.body.productId)
    .then((item) => req.user.addToCart(item))
    .then(() => res.redirect('/cart'))
    .catch(err => forwardError(err, next));
};

exports.postCartDeleteProduct = (req, res, next) => {
  req.user
    .deleteProductFromCart(req.body.productId)
    .then(() => res.redirect('/cart'))
    .catch(err => forwardError(err, next));
};

exports.getCheckout = (req, res, next) => {
  let items;
  req.user
    .populate('cart.products.productId')
    .execPopulate()
    .then((user) => {
      items = user.cart.products;
      return stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: items.map(item => {
          return {
            name: item.productId.title,
            description: item.productId.description,
            amount: item.productId.price.toFixed(1) * 100,
            currency: 'usd',
            quantity: item.quantity
          };
        }),
        // http://localhost:3000/checkout/success
        success_url:
          req.protocol + '://' + req.get('host') + '/checkout/success',
        // http://localhost:3000/checkout/cancel
        cancel_url:
          req.protocol + '://' + req.get('host') + '/checkout/cancel',
      });
    })
    .then(session => res.render('shop/checkout', {
      title: 'Order Checkout',
      path: null,
      items,
      totalPrice: items.reduce((price, item) => {
        return price + item.quantity * item.productId.price;
      }, 0),
      sessionId: session.id
    }))
    .catch(err => forwardError(err, next));
};

exports.getCheckoutSuccess = (req, res, next) => {
  req.user
    .populate('cart.products.productId')
    .execPopulate()
    .then((user) => {
      const items = user.cart.products.map(
        prod => ({
          product: { ...prod.productId._doc },
          quantity: prod.quantity
        })
      );
      return new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        items
      });
    })
    .then(order => order.save())
    .then(() => req.user.clearCart())
    .then(() => res.redirect('/orders'))
    .catch(err => forwardError(err, next));
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then((orders) => {
      res.render('shop/orders', {
        title: 'Your Past Orders',
        path: '/orders',
        orders
      });
    })
    .catch(err => forwardError(err, next));
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then(order => {
      if (!order) {
        return forwardError('No order found for id = ' + orderId, next);
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return forwardError('Unauthorized', next);
      }

      const invoiceName = 'invoice-' + orderId + '.pdf';
      const invoicePath = path.join('data', 'invoices', invoiceName);

      // fs.readFile(invoicePath, (err, data) => {
      //   if (err) {
      //     forwardError(err, next);
      //   }
      //   res.setHeader('Content-Type', 'application/pdf');
      //   res.setHeader(
      //     'Content-Disposition',
      //     'inline; filename="' + invoiceName + '"'
      //   );
      //   res.send(data);
      // });

      // const file = fs.createReadStream(invoicePath);
      // res.setHeader('Content-Type', 'application/pdf');
      // res.setHeader(
      //   'Content-Disposition',
      //   'inline; filename="' + invoiceName + '"'
      // );
      // file.pipe(res);

      const pdfDoc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="' + invoiceName + '"'
      );
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);

      pdfDoc.fontSize(26).text('Invoice', {
        underline: true
      });
      pdfDoc.text(' ');
      pdfDoc.text('-----------------------------------------------');
      pdfDoc.text(' ');
      let totalPrice = 0;
      order.products.forEach(prod => {
        pdfDoc.fontSize(14).text(
          prod.product.title
          + ' - ' +
          prod.quantity +
          ' x $' +
          prod.product.price
        );
        totalPrice += prod.product.price * prod.quantity;
      });
      pdfDoc.text(' ');
      pdfDoc.fontSize(18).text('Total Price: $' + totalPrice);

      pdfDoc.end();
    })
    .catch(err => forwardError(err, next));
};
