var port = 1337;
var on = true;

var WebSocketServer = require('ws').Server;
var server = new WebSocketServer({port: port});

var MIN_WIDTH = 480;
var MIN_HEIGHT = 320;

var MAX_WIDTH = 1280;
var MAX_HEIGHT = 800;

var PAD_HEIGHT = 64;

var court = {
	w: MAX_WIDTH,
	h: MAX_HEIGHT
};


var g = {
	court: court,

	pads: {
		left: { x: 16, y: court.h / 2 - (PAD_HEIGHT / 2), w: 16, h: PAD_HEIGHT, down: false, up: false, speed: 7, points: 0, accel: 0, active: false },
		right: { x: court.w - 32, y: court.h / 2 - (PAD_HEIGHT / 2) , w: 16, h: PAD_HEIGHT, down: false, up: false, speed: 7, points: 0, accel: 0, active: false },
	},

	ball: {
		x: court.w / 2 - (24 / 2),
		y: court.h / 2 - (24 / 2),
		dx: -3,
		dy: 3,
		w: 16,
		h: 16,
		speed: 2,
		sparks: 0
	}
};

var players = {
	left: null,
	right: null
};


var getSideByConnection = function(connection) {
	if (players.left === connection) { return 'left'; }
	else if (players.right === connection) { return 'right'; }
};

var getPadByConnection = function(connection) {
	var side = getSideByConnection(connection);
	if(side) {
		return g.pads[side];
	}
};

var frame = 0;

var tick = function() {

	if(!on) {return;}

	var movePad = function(pad) {
		var max = 4;
		var accelDivide = 3;
		if(pad.up && pad.down || !pad.up && !pad.down) {
			pad.accel = 0;
		}
		else if (pad.down) {
			pad.accel++;
			if (pad.y + pad.h < g.court.h) {
				pad.y += pad.speed * Math.min(Math.max(pad.accel / accelDivide, 1), max);
			} else {
				pad.y = g.court.h - pad.h;
			}
		}
		else if (pad.up) {
			pad.accel++;
			if (pad.y > 0) {
				pad.y -= pad.speed * Math.min(Math.max(pad.accel / accelDivide, 1), max);
			} else {
				pad.y = 0;
			}
		}
	};

	var hitTestBall = function(ball, pad) {

		var pointInsidePad = function(px, py, pad) {
			return (px >= pad.x && px <= pad.x + pad.w) && (py >= pad.y && py <= pad.y + pad.h);
		};

		if(
			pointInsidePad(ball.x, ball.y, pad) || //Top left
			pointInsidePad(ball.x + ball.w, ball.y, pad) || //Top right
			pointInsidePad(ball.x + ball.w, ball.y + ball.h, pad) || //Bottom right
			pointInsidePad(ball.x, ball.y + ball.h, pad) //Bottom left
		) {
			return pad;
		}
		return null;
	};

	var resetBall = function() {
		g.court.w = Math.max(MAX_WIDTH * Math.random(), MIN_WIDTH);
		g.court.h = Math.max(MAX_HEIGHT * Math.random(), MIN_HEIGHT);
		g.pads.right.x = g.court.w - 32;
		g.pads.left.y = Math.min(g.pads.left.y, g.court.h - g.pads.left.h);
		g.pads.right.y = Math.min(g.pads.right.y, g.court.h - g.pads.right.h);

		g.ball.x = g.court.w / 2 - (g.ball.w / 2);
		g.ball.y = g.court.h / 2 - (g.ball.h / 2);
		g.ball.speed = 2;
		if(Math.round(Math.random()) == 1) {
			reverseBallX();
		}
	};

	var reverseBallX = function() {
		g.ball.dx = g.ball.dx * -1;
	};

	var hitPad = null;

	if (g.ball.x + g.ball.w > g.court.w + 16) {
		if(g.pads.right.active) {
			g.pads.left.points++;
			resetBall();
		} else {
			reverseBallX();
		}
		g.pads.left.h += 16;
		g.pads.left.h = Math.min(g.pads.left.h, g.court.h);
		g.pads.right.h = PAD_HEIGHT;
	}
	else if (g.ball.x < -16) {
		if(g.pads.left.active) {
			g.pads.right.points++;
			resetBall();
		} else {
			reverseBallX();
		}
		g.pads.right.h += 16;
		g.pads.right.h = Math.min(g.pads.right.h, g.court.h);
		g.pads.left.h = PAD_HEIGHT;
	}

	[g.pads.left, g.pads.right].forEach(function(pad) {
		movePad(pad);
		if(hitTestBall(g.ball, pad)) {
			hitPad = pad;
		}
	});

	if(g.ball.sparks > 0) { g.ball.sparks = 0; }

	//ball hits pad, sparks fly
	if(hitPad) {
		g.ball.sparks = g.ball.speed * 20;
		g.ball.speed = Math.max(g.ball.speed += 1 ,5);
		hitPad.accel = 0;
		g.ball.dx = g.ball.dx * - 1;
	}

	//ball hits edge
	if(g.ball.y <= 0 || g.ball.y + g.ball.h >= g.court.h) {
		g.ball.dy = g.ball.dy * - 1;
		g.ball.sparks = g.ball.speed * 10;
	}

	g.ball.speed = Math.max(g.ball.speed, 1);

	//ball movement
	g.ball.x += g.ball.dx * g.ball.speed;
	g.ball.y += g.ball.dy * g.ball.speed;

	if(g.ball.speed > 3) {
		g.ball.speed -= 0.001;
	}

	[players.left, players.right].forEach(function(player) {
		if(player)
			player.send(JSON.stringify(g));
	});

	//console.log(g.ball.speed, frame, frame / 1000);
	//g.ball.speed = Math.max(g.ball.speed * (frame + 1000 / 1000));
	frame++;
};

server.on('connection', function(connection) {

	var spectator = false;
	var side;

	if (players.left === null) {
		players.left = connection;
		side = 'left';
		g.pads.left.active = true;
	}
	else if (players.right === null) {
		players.right = connection;
		side = 'right';
		g.pads.right.active = true;
	}
	else { spectator = true; }

	console.log((spectator ? 'spectator' : side), ' joined!');
	connection.send(JSON.stringify(g));

	// Callback to handle each message from the client
	connection.on('message', function(message) {
		var data = JSON.parse(message);
		var pad = getPadByConnection(connection);
		if(pad) {
			if(data.y) {
				pad.y = Math.max(Math.min(data.y, g.court.h - pad.h), 0);
				pad.accel = 0;
			} else {
				if(pad.down != data.down || pad.up != pad.up) {
					pad.accel = 0;
				}
				pad.down = data.down;
				pad.up = data.up;
			}
		}
	});

	connection.on('close', function(message) {
		var side = getSideByConnection(connection);
		players[side] = null;
		g.pads[side].active = false;
		console.log(side, 'left');
	});
});

var interval = setInterval(tick, 1000 / 33);