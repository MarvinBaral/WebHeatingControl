# njsWebHeatingControl
Author: Marvin Baral

A node.js server on a embedded device (Raspberry Pi 3 on Arch Linux here) to control heating elemts like gas-burner or pumps and display temperature of certain elements alltogether on a cental webinterface through .svg - images with color -to-temperature mapping. A graph of all temperatures is also included here (also .svg).

## Preview
### Water temperature storage

![storage](https://user-images.githubusercontent.com/11145294/69012388-7bbc8f00-0975-11ea-8a42-d511664265e4.png)
![storage2](https://user-images.githubusercontent.com/11145294/69012389-7bbc8f00-0975-11ea-81f2-febf61cc9da1.png)
![storage3](https://user-images.githubusercontent.com/11145294/69012390-7c552580-0975-11ea-95cf-452bd38fc45d.png)

Legend:

![legend](https://user-images.githubusercontent.com/11145294/69012387-7bbc8f00-0975-11ea-8da2-cc7eef7daac0.png)
### Graph
![graph](https://user-images.githubusercontent.com/11145294/69012386-7bbc8f00-0975-11ea-819d-0b37cffbab52.png)

## Supported Browsers
* Firefox
* Chromium
* ...

Basically every Browser supporting Java-Script and SVG-Images with CSS-classes (-> not Internet Explorer)

## Default Rpi3 GPIO mapping:
* pump_burner_circle: 21
* burner: 20
* ventil_left: 22 (not implemented)
* ventil_right: 23 (not implemented)
* mixer_left: 24
* mixer_right: 25
* pump_heating_circle: 26
