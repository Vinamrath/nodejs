const { validationResult } = require('express-validator');

const Product = require('../models/product');
const { fetchAllItems, forwardError, deleteFile } = require('../utils');

const renderItemForm = (
  res,
  status = 200,
  item = {},
  errorMessage = null,
  validationErrors = [],
  title = 'Add Item',
  path = '/admin/add-product',
  editing = false
) => {
  return res.status(status).render('admin/edit-product', {
    title,
    path,
    editing,
    item,
    errorMessage,
    validationErrors
  });
};

const renderItemFormError = (
  req,
  res,
  errorMessage,
  validationErrors = []) => {
  return renderItemForm(
    res,
    422,
    {
      title: req.body.title,
      price: +req.body.price,
      description: req.body.description
    },
    errorMessage,
    validationErrors
  );
};

const renderEditItemForm = (
  res,
  item,
  status = 200,
  errorMessage = null,
  validationErrors = []
) => {
  return renderItemForm(
    res,
    status,
    item,
    errorMessage,
    validationErrors,
    'Edit Item',
    '/admin/edit-product',
    true
  );
};

exports.getAddProduct = (req, res, next) => {
  renderItemForm(res);
};

exports.postAddProduct = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return renderItemFormError(
      req,
      res,
      errors.array()[0].msg,
      errors.array()
    );
  }

  if (!req.file) {
    return renderItemFormError(req, res, 'Attached file is not an image.');
  }

  const item = new Product({
    title: req.body.title,
    price: +req.body.price,
    imageUrl: req.file.path,
    description: req.body.description,
    userId: req.user
  });
  item
    .save()
    .then(() => res.redirect('/products'))
    .catch(err => forwardError(err, next));
};

exports.getProducts = (req, res, next) => {
  fetchAllItems(
    'admin/products',
    'Admin Items',
    '/admin/products',
    req,
    res,
    next,
    { userId: req.user._id }
  );
};

exports.getEditProduct = (req, res, next) => {
  const editMode = req.query.edit;
  if (!editMode) {
    return res.redirect('/admin/products');
  }
  Product.findById(req.params.productId)
    .then((item) => {
      if (!item) {
        return res.redirect('/admin/products');
      }
      renderEditItemForm(res, item);
    })
    .catch(err => forwardError(err, next));
};

exports.postEditProduct = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return renderEditItemForm(
      res,
      {
        title: req.body.title,
        price: +req.body.price,
        description: req.body.description,
        _id: req.body.id
      },
      422,
      errors.array()[0].msg,
      errors.array()
    );
  }

  Product.findById(req.body.id)
    .then((item) => {
      // Protect the edit by another user
      if (item.userId.toString() !== req.user._id.toString()) {
        return res.redirect('/');
      }
      item.title = req.body.title;
      item.price = +req.body.price;
      item.description = req.body.description;
      if (req.file) {
        deleteFile(item.imageUrl);
        item.imageUrl = req.file.path;
      }
      return item.save()
        .then(() => res.redirect('/admin/products'));
    })
    .catch(err => forwardError(err, next));
};

exports.postDeleteProduct = (req, res, next) => {
  Product.findById(req.body.id)
    .then(item => {
      if (!item) {
        return forwardError('No Item for id = ' + req.body.id);
      }
      deleteFile(item.imageUrl);
      return Product.deleteOne({ _id: req.body.id, userId: req.user._id });
    })
    .then(() => res.redirect('/admin/products'))
    .catch(err => forwardError(err, next));
};
