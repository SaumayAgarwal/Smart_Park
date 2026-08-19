const { prisma } = require('../config/db');

class WalletController {
  // GET /api/wallet/balance
  async getWalletBalance(req, res, next) {
    try {
      const userId = req.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, walletBalance: true },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({
        success: true,
        message: 'Wallet balance fetched successfully',
        data: {
          walletBalance: Number(user.walletBalance || 0),
          userId: Number(user.id),
          email: user.email,
          name: user.name,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new WalletController();
