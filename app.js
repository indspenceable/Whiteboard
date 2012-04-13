var express = require('express');
var io = require('socket.io');

var app = express.createServer()
, io = io.listen(app);

io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});

app.register('.jade', require('jade'));
app.set('view options', {
  layout: false
})

// Root to index page. Doesn't exist yet.
app.get('/', function(req,res) {
  res.render('index.jade');
});
// /(board) to that board.
app.get('/:board', function(req,res) {
  res.render('board.jade', {board: req.params.board});
})

app.listen(process.env.PORT || 5656);


io.sockets.on('connection', function (socket) {
  // on a join, add them to the right board and save that 
  // property on their socket.
  socket.on('join', function(data) {
    console.log("Joining board ", data.board)
    socket.set('board', data.board)
    socket.join(data.board)
  });

  // On a message, broadcast it to everyone in their board.
  socket.on('draw', function(data) {
    socket.get('board', function(err, board){
      console.log("Broadcasting to ", board)
      socket.broadcast.to(board).emit('draw', data)
    })
  })
});
