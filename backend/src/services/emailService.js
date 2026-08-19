const { transporter, fromEmail } = require('../config/mailer');

class EmailService {
  /**
   * Asynchronously sends HTML booking confirmation email to the driver.
   */
  async sendBookingConfirmationEmail(booking, driver, spot) {
    if (!driver || !driver.email) return;

    const formatDate = (date) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    };

    const formattedStart = formatDate(booking.startTime);
    const formattedEnd = formatDate(booking.endTime);

    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1e293b; background-color: #f8fafc; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
            <h2 style="color: #0d9488; margin-top: 0;">Parking Reservation Confirmed! 🎉</h2>
            <p>Hello <strong>${driver.name || 'Driver'}</strong>,</p>
            <p>Your parking spot has been reserved successfully. Here are your booking details:</p>
            <div style="background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>Reference ID:</strong> <span style="color: #0d9488;">${booking.bookingReference || `#BK-${booking.id}`}</span></p>
              <p style="margin: 4px 0;"><strong>Location:</strong> ${spot?.title || 'Parking Spot'}</p>
              <p style="margin: 4px 0;"><strong>Address:</strong> ${spot?.address || ''}, ${spot?.city || ''}</p>
              <p style="margin: 4px 0;"><strong>Start Time:</strong> ${formattedStart}</p>
              <p style="margin: 4px 0;"><strong>End Time:</strong> ${formattedEnd}</p>
              <p style="margin: 4px 0;"><strong>Vehicle:</strong> ${booking.vehicleNumber || 'N/A'}</p>
              <p style="margin: 4px 0;"><strong>Total Paid:</strong> ₹${Number(booking.amount).toFixed(2)}</p>
            </div>
            <p style="font-size: 0.9em; color: #64748b;">Show your QR code ticket upon arrival at the parking location.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 0.8em; color: #94a3b8; text-align: center;">SmartPark Marketplace &bull; Seamless Urban Parking</p>
          </div>
        </body>
      </html>
    `;

    try {
      await transporter.sendMail({
        from: fromEmail,
        to: driver.email,
        subject: `🅿️ Booking Confirmed - ${spot?.title || 'SmartPark'}`,
        html: htmlContent,
      });
      console.log(`Booking confirmation email sent to ${driver.email}`);
    } catch (err) {
      console.warn(`Failed to send booking confirmation email: ${err.message}`);
    }
  }
}

module.exports = new EmailService();
