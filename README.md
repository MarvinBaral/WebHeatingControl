# HeatingControl-Webinterface
Author: Marvin Baral (github@marvinbaral.de)

A node.js server on a embedded device (Raspberry Pi 3 on Arch Linux here) to control heating elemts like gas-burner or pumps and display temperature of certain elements altogether on a webinterface (in your LAN of course, public would be a bad idea).
The file "heating-webserver.service" has to be edited and placed in /etc/systemd/system/ . Furthermore it has to be sure, that this and the "webserver.js" are executable
