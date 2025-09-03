// filepath: utils/mailer.js
const nodemailer = require('nodemailer');

// Configure your transporter (example uses Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // set in your .env
    pass: process.env.EMAIL_PASS, // set in your .env
  },
});

async function sendMail({ to, subject, text, html }) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
    html,
  };
  return transporter.sendMail(mailOptions);
}

module.exports = { sendMail };