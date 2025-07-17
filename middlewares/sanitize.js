module.exports = (req, res, next) => {
  const sanitize = obj => {
    for (let key in obj) {
      if (/^\$/.test(key) || /\./.test(key)) delete obj[key];
      else if (typeof obj[key] === 'object') sanitize(obj[key]);
    }
  };

  if (req.body) sanitize(req.body);
  if (req.params) sanitize(req.params);
  next();
};
