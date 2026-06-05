const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.ethereal.email",
  port: 587,
  secure: false,
  auth: {
    user: "arne.schroeder@ethereal.email",
    pass: "YE4qPkxtrwSVgmVfgk",
  },
});

exports.sendLowStockAlert = async (
  productName,
  sku,
  currentStock,
  threshold,
) => {
  try {
    const mailOptions = {
      from: '"Warehouse Alert System" <no-reply@inventoryapi.com>',
      to: process.env.ADMIN_EMAIL || "manager@example.com", // Destination
      subject: `🚨 LOW STOCK ALERT: ${productName} (${sku})`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ecc94b; background-color: #fffaf0; border-radius: 5px;">
          <h2 style="color: #dd6b20; margin-top: 0;">Inventory Alert: Stock Depleted Below Threshold</h2>
          <p>The following item has dropped below its safe operational threshold limit:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr style="background-color: #f7fafc;"><td style="padding: 8px; font-weight: bold;">Product Name:</td><td style="padding: 8px;">${productName}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">SKU Code:</td><td style="padding: 8px;">${sku}</td></tr>
            <tr style="background-color: #f7fafc;"><td style="padding: 8px; font-weight: bold;">Current Inventory:</td><td style="padding: 8px; color: #e53e3e; font-weight: bold;">${currentStock} units</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Safety Threshold:</td><td style="padding: 8px;">${threshold} units</td></tr>
          </table>
          <p style="font-size: 12px; color: #718096; margin-bottom: 0;">This is an automated operational system message. Please log into the dashboard to update stock quantities.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(
      `📩 Low-stock email alert dispatched for ${sku}. Message ID: ${info.messageId}`,
    );
  } catch (error) {
    // We log the error but don't pass it to next(error) because we
    console.error(
      "❌ Background email notification failed to send:",
      error.message,
    );
  }
};
