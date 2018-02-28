# njsWebHeatingControl
Author: Marvin Baral (github@marvinbaral.de)

A node.js server on a embedded device (Raspberry Pi 3 on Arch Linux here) to control heating elemts like gas-burner or pumps and display temperature of certain elements alltogether on a cental webinterface through .svg - images with color -to-temperature mapping. A graph of all temperatures is also included here (also .svg).

## Preview
### Water temperature storage
![](https://www.marvinbaral.de/image/svg+xml/Uploads/HeatingControl/storage.svg)
![](https://www.marvinbaral.de/image/svg+xml/Uploads/HeatingControl/storage2.svg)
![](https://www.marvinbaral.de/image/svg+xml/Uploads/HeatingControl/storage3.svg)

Legend:

![](https://www.marvinbaral.de/image/svg+xml/Uploads/HeatingControl/legend.svg)
###Graph
![](https://www.marvinbaral.de/image/svg+xml/Uploads/HeatingControl/graph.svg)
## Setup
### Adapt to your reguirements
In the current state, you have to adapt all elements and their control logik to your heating system. In future, a graphical editor is planned to make this possible for every noob.
### Make it running
The file "heating.service" has to be edited and placed in /etc/systemd/system/ . Furthermore it has to be sure, that this and the "webserver.js" are executable. After this, "systemctl enable heating" has to be executed to start it at every reboot.

## Supported Browsers
* Firefox
* Chromium
* ...

Basically every Browser supporting Java-Script and SVG-Images with CSS-classes (-> not Internet Explorer)

