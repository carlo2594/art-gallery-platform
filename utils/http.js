// utils/http.js

function wantsHTML(req) {
  return req.accepts(['html', 'json']) === 'html';
}

module.exports = { wantsHTML };
