let io = null;

function initSocket(ioInstance) {
  io = ioInstance;

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join user-specific room: { role, email }
    socket.on('join', ({ role, email }) => {
      if (!email) return;
      const room = role === 'OWNER' ? `owner:${email}` : `driver:${email}`;
      socket.join(room);
      console.log(`👤 User joined room: ${room}`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
}

function emitToDriver(driverEmail, event, data) {
  if (!io || !driverEmail) return;
  io.to(`driver:${driverEmail}`).emit(event, data);
}

function emitToOwner(ownerEmail, event, data) {
  if (!io || !ownerEmail) return;
  io.to(`owner:${ownerEmail}`).emit(event, data);
}

module.exports = { initSocket, emitToDriver, emitToOwner };
