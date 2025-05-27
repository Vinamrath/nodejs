const fs = require('fs');

const Product = require('./models/product');

const ITEMS_PER_VIEW = 2;

const fetchAllItems = (file, title, path, req, res, next, condition = {}) => {
  let page = +req.query.page || 1;
  let totalItems;

  Product.find(condition).countDocuments()
    .then(itemsCount => {
      totalItems = itemsCount;
      return Product.find(condition)
        .skip((page - 1) * ITEMS_PER_VIEW)
        .limit(ITEMS_PER_VIEW)
    })
    .then((items) => res.render(file, {
      items,
      title,
      path,
      currentPage: page,
      hasNextPage: ITEMS_PER_VIEW * page < totalItems,
      hasPreviousPage: page > 1,
      nextPage: page + 1,
      previousPage: page - 1,
      lastPage: Math.ceil(totalItems / ITEMS_PER_VIEW)
    }))
    .catch(err => forwardError(err, next));
};

const getErrorMessage = (req) => {
  let errorMessage = req.flash('error');
  if (errorMessage.length > 0) {
    errorMessage = errorMessage[0];
  } else {
    errorMessage = null;
  }
  return errorMessage;
};

const forwardError = (err, next) => {
  console.log(err);
  const error = new Error(err);
  error.httpStatusCode = 500;
  return next(error);
}

const deleteFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) {
      throw err;
    }
  })
}

exports.fetchAllItems = fetchAllItems;
exports.getErrorMessage = getErrorMessage;
exports.forwardError = forwardError;
exports.deleteFile = deleteFile;
