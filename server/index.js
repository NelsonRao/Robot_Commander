var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var ROSLIB = require('roslib');

var ros;						// this will be the connection to ROS
var connected = false;
var topicName = '/cmd_vel';
var speedFactor = 1.0;								// multiplies or divides speed to go faster or slower
var stopMotion = true;
var repeatInterval = 20;
var curWaypoint = 'A';

const Gpio = require('pigpio').Gpio;
const motor1 = new Gpio(4, { mode: Gpio.OUTPUT });
const motor2 = new Gpio(17, { mode: Gpio.OUTPUT });
const motor3 = new Gpio(18, { mode: Gpio.OUTPUT });
//const motor1 = new Gpio(0, { mode: Gpio.OUTPUT });
//let pulseWidth =700;
//let increment=100;

// Create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })

function sendTwistMessage(xMove, zMove) {
    var reps = 0;
    // linear x and y movement and angular z movement

    var cmdVel = new ROSLIB.Topic({
        ros: ros,
        name: topicName,
        messageType: 'geometry_msgs/Twist'
    });

    var twist = new ROSLIB.Message({
        linear: {
            x: xMove * speedFactor,
            y: 0.0,
            z: 0.0
        },
        angular: {
            x: 0.0,
            y: 0.0,
            z: zMove * speedFactor
        }
    });
    if ((xMove == 0) && (zMove == 0)) {			// it is a stop command
        reps = 0;
        cmdVel.publish(twist);
    } else {
        reps = Math.max(1, Math.abs(twist.linear.x) > 0 ? linearRepeat : (Math.abs(twist.angular.z) > 0 ? angularRepeat : 1));
        stopMotion = false;
        console.log("Sending Twist x:" + xMove + " z:" + zMove + ", " + reps + " repetitions at " + repeatInterval + " ms. interval");
        if (typeof cmdVel.ros != "undefined") {			// this would be if we are not connected
            publishCmd();
        }
    }

    function publishCmd() {
        if (!stopMotion) {					// can be set while command is repeating -- purpose is to stop repitition
            //	console.log ("repeating twist " + reps);
            cmdVel.publish(twist);
            if (reps > 1) {
                setTimeout(publishCmd, repeatInterval);
                reps = reps - 1;
            }
        }
    }
}

function cancelRobotMove() {
    if (connected) {
        var moveClient = new ROSLIB.ActionClient({
            ros: ros,
            serverName: '/move_base',
            actionName: 'move_base_msgs/MoveBaseAction'
        });
        moveClient.cancel();  //cross fingers and hope?
    }
}

function stopRobot() {
    stopMotion = true;
    sendTwistMessage(0, 0);
    cancelRobotMove();
}

function sendMarker() { //(atPose) {
    var markerTopic = new ROSLIB.Topic({
        ros: ros,
        name: "/visualization_marker",
        messageType: "visualization_msgs/Marker"
    });

    var marker = new ROSLIB.Message({
        header: {
            frame_id: "base_link",			// or just ""?
            stamp: {}
        },
        ns: "Commander",
        id: 0,
        type: 2,		//visualization_msgs::Marker::SPHERE,
        action: 0,		//visualization_msgs::Marker::ADD,
        pose: {
            position: {
                x: 1,
                y: 1,
                z: 1
            },
            orientation: {
                x: 0.0,
                y: 0.0,
                z: 0.0,
                w: 1.0
            }
        },
        scale: {
            x: 0.2,
            y: 0.2,
            z: 0.2
        },
        color: {
            a: 1.0, // Don't forget to set the alpha!
            r: 1.0,
            g: 1.0,
            b: 0.0
        }
        //text: "Waypoint";
        //only if using a MESH_RESOURCE marker type:
        //marker.mesh_resource = "package://pr2_description/meshes/base_v0/base.dae";
    });

    //marker.pose = atPose;
    if (connected) {
        console.log('Sending marker: ' + JSON.stringify(marker));
        markerTopic.publish(marker);
    } else {
        // say ("You need to be connected");
        console.log("You need to be connected");
    }
}

function moveRobotToPose(movePose) {
    var prevStatus = "";
    var statusString;
    var moveToPoseClient = new ROSLIB.ActionClient({
        // object with following keys: * ros - the ROSLIB.Ros connection handle * serverName - the action server name * actionName - the action message name * timeout - the timeout length when connecting to the action server
        ros: ros,
        serverName: '/move_base',
        actionName: 'move_base_msgs/MoveBaseAction'
    });

    var goal = new ROSLIB.Goal({
        actionClient: moveToPoseClient,
        goalMessage: {
            target_pose: {
                header: {
                    frame_id: '/map'
                },
                pose: movePose
            }
        }
    });

    goal.on('status', function (status) {
        statusString = 'Move to pose status: ' + JSON.stringify(status);
        if (statusString !== prevStatus) {
            prevStatus = statusString;
            if (status.status == 4) {
                // say (status.text);
                console.log(status.text);
            }
            console.log(statusString);
        }
    });

    goal.on('result', function (result) {
        console.log('Move to pose result: ' + JSON.stringify(result));
        sendMarker(result);
    });

    goal.on('feedback', function (feedback) {
        console.log('Move to pose feedback: ' + JSON.stringify(feedback));
    });

    goal.send();
    console.log('moveRobotToPose goal sent, movepose: ' + JSON.stringify(movePose));
}

function goToWaypoint(waypointName) {
    // curWaypoint = waypointName;
    var waypointPose;
    // rosConnect();
    // console.log(ros.id);
    if (connected) {
        // console.log(JSON.stringify(ros));
        var waypoint = new ROSLIB.Param({
            ros: ros,
            name: ''
        });
        waypoint.name = "/waypoint/" + waypointName;
        waypoint.get(function (value) {
            if (!value) {
                // say ('Waypoint ' + waypointName + ' was not found');
                alert('Waypoint ' + waypointName + ' was not found');
                console.log('Waypoint ' + waypointName + ' was not found');
            }
            else {
                console.log('Value of waypoint ' + waypointName + ': ' + value);
                if (value == "0") {
                    // say ('Waypoint ' + waypointName + ' has been removed');
                    alert('Waypoint ' + waypointName + ' has been removed');
                    console.log('Waypoint ' + waypointName + ' has been removed');
                } else {
                    value = value.replace('translation', 'position');		// convert tf pose to geometry
                    value = value.replace('rotation', 'orientation');
                    waypointPose = JSON.parse(value);
                    moveRobotToPose(waypointPose);
                }
            }
        });
    }
}


function rosConnect(robotUrl) {
    // var ros = new ROSLIB.Ros({
    //     url: 'ws://localhost:9090'
    // });

    ros = new ROSLIB.Ros({
        url: robotUrl
    });

    ros.on('connection', function () {
        connected = true;
        console.log('Connected to websocket server.');
    });

    ros.on('error', function (error) {
        console.log('Error connecting to websocket server: ', error);
    });

    ros.on('close', function () {
        connected = false;
        console.log('Connection to websocket server closed.');
    });
}

if (!connected) {
    // rosConnect("ws://localhost:9090");
    rosConnect("ws://bbb.local:9090");
}

app.use(express.static('public'));
app.get('/index.html', function (req, res) {
    res.sendFile(__dirname + "/" + "index.html");
})

//Stop robot
app.get('/stop', urlencodedParser, function (req, res) {
    // Prepare output in JSON format
    // response = {
    //     first_name: req.body.first_name,
    //     last_name: req.body.last_name
    // };
    // console.log(response);
    // res.end(JSON.stringify(response));
    stopRobot();
})

//Go to waypoint by waypoint name
//localhost:8081/gwp?wp=A
app.get('/gotowaypoint', urlencodedParser, function (req, res) {
    console.log(req.query.name);
    curWaypoint = req.query.name;
    goToWaypoint(req.query.name);
    res.send('ok');

})

app.get('/nextwaypoint', urlencodedParser, function (req, res) {
    // console.log(req.query.wp);
    if (curWaypoint == 'A') {
        console.log('Go to waypoint B');
        curWaypoint = 'B';
        goToWaypoint('B');
    }
    else {
        console.log('Go to waypoint A');
        curWaypoint = 'A';
        goToWaypoint('A');
    }
    res.send('ok');

})

app.get('/d',urlencodedParser, function(req,res){
res.send('ok');
motor1.servoWrite(1700);
setTimeout(()=>{
motor1.servoWrite(700);

if(curWaypoint == 'A'){
console.log('Go to waypoint B');
curWaypoint='B';
goToWaypoint('B');
}
else{
console.log('Go to waypoint A');
curWaypoint='A';
goToWaypoint('A');
}

},5000)

})


app.get('/w',urlencodedParser, function(req,res){
res.send('ok');
motor2.servoWrite(1700);
setTimeout(()=>{
motor2.servoWrite(700);

if(curWaypoint == 'A'){
console.log('Go to waypoint B');
curWaypoint='B';
goToWaypoint('B');
}
else{
console.log('Go to waypoint A');
curWaypoint='A';
goToWaypoint('A');
}

},5000)

})

app.get('/r',urlencodedParser, function(req,res){
res.send('ok');
motor3.servoWrite(1700);
setTimeout(()=>{
motor3.servoWrite(700);

if(curWaypoint == 'A'){
console.log('Go to waypoint B');
curWaypoint='B';
goToWaypoint('B');
}
else{
console.log('Go to waypoint A');
curWaypoint='A';
goToWaypoint('A');
}

},5000)

})

var server = app.listen(8081, function () {
    var host = server.address().address
    var port = server.address().port

/*setInterval(()=>{
console.log("interval runing");
motor1.servoWrite(pulseWidth);
*/
/*pulseWidth += increment;

if(pulseWidth>=2000)
{
increment=-100;
}
else if (pulseWidth<=700){
increment=100;
}
*/
/*if(pulseWidth==700)
pulseWidth=1700;
else if(pulseWidth==1700)
pulseWidth=700;

},3000)
*/

    console.log("Example app listening at http://%s:%s", host, port)
})
