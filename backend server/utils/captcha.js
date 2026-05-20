const jwt = require('jsonwebtoken');

const generateCaptcha = () => {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const operations = ['+', '-'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  
  let answer;
  let question;
  
  if (operation === '+') {
    answer = num1 + num2;
    question = `${num1} + ${num2} = ?`;
  } else {
    // Ensure positive results for client friendliness
    const max = Math.max(num1, num2);
    const min = Math.min(num1, num2);
    answer = max - min;
    question = `${max} - ${min} = ?`;
  }
  
  // Sign the answer in a highly secure, short-lived (3 mins) token
  const token = jwt.sign({ answer: String(answer) }, process.env.JWT_SECRET || 'captcha_secret_dev', {
    expiresIn: '3m'
  });
  
  return {
    question,
    captchaToken: token
  };
};

const verifyCaptcha = (answer, token) => {
  if (!answer || !token) return false;
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'captcha_secret_dev');
    return String(decoded.answer).trim() === String(answer).trim();
  } catch (error) {
    return false;
  }
};

module.exports = {
  generateCaptcha,
  verifyCaptcha
};
