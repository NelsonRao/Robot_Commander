# Robot Commander

Robot Commander runs on an Android device.  

## Usage
Follow these instructions to install and run Robot Commander.

### Installation:

### Startup

Each time you wish to start using Robot Commander:

* Start the app.

* Bring up your robot.  

* Access the web URL

* in the web page, enter the robot's url with port number (usually 9090)

        <robot's url>:9090 
into the Robot URL box and click the Connect button.  The button should now say Disconnect, and you should hear "Connected". 
Use "wss" or "https" for the robot's websocket address.

If your robot has a local address, you may use it instead of the numeric IP address.


### Running
* Press any arrow to move the robot.

#To Do / Issues
Though you can set waypoints, they are not persistent across shutdown/restart.  

#Dependencies

In the robot: rosbridge_server and tf2_web_republisher.
In the browser: See the *link* and *script* statements in the code.  

# Build

# License

# Authors

