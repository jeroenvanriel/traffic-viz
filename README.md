# Lightweight SUMO Visualization

Interactive web-based visualization tool for replaying prerecorded traffic simulations, based on [SUMO network files](https://sumo.dlr.de/docs/Networks/SUMO_Road_Networks.html) and [SUMO floating car data](https://sumo.dlr.de/docs/Simulation/Output/FCDOutput.html).

![Screenshot](./screenshot.png)


## ✨ Features

- Replay prerecorded vehicle movements directly in the browser
- Programmable sequences of camera movement
- Built-in screen recording for easy video capture

## Getting started

Prebuilt executables for Windows are available on the [Releases page](https://github.com/jeroenvanriel/traffic-viz/releases).

### Creating a new scene

Each scene is defined by a folder inside the `scenes/` directory. A valid scene must contain:

- `road.net.xml` — the SUMO network file

- `fcd.xml` — floating car data output

Follow SUMO's [Hello World](https://sumo.dlr.de/docs/Tutorials/Hello_World.html) tutorial to create a simple SUMO simulation. Make sure to use `road.net.xml` as the name for the network file.
After verifying that the simulation runs in `sumo-gui`, use the command `sumo -c helloWorld.sumocfg --fcd-output fcd.xml` to create a floating car data export of the simulation; see [FCDOutput](https://sumo.dlr.de/docs/Simulation/Output/FCDOutput.html) for more information.

> 💡 **Tip:** Instead of using the graphical [`netedit`](https://sumo.dlr.de/docs/Netedit/index.html) tool, you can also use the [osmWebWizard.py](https://sumo.dlr.de/docs/Tools/Import/OSM.html) script, included with SUMO, to easily create realistic traffic scenarios by importing map data from OpenStreetMap. For more information, see the [OpenStreetMap import documentation](https://sumo.dlr.de/docs/Networks/Import/OpenStreetMap.html).


## Development

The Python backend is build using the FastAPI library. The frontend is written in Typescript and uses the React framework.

```bash
# backend
cd backend
pip install -r requirements.txt
fastapi dev app/main.py
```

```bash
# frontend
cd frontend
# nvm use 25
npm install
npm run dev
```

### How it works

- The backend parses the network file and converts roads into polygon data.
- The frontend renders the network and animates vehicles.
- Vehicle movements are streamed as *delta packets*, minimizing redundant data transfer.


## Acknowledgements

This project was heavily inspired by the ideas and design of 
[SUMO‑Web3D](https://github.com/sidewalklabs/sumo-web3d) 
by Sidewalk Labs (licensed under the Eclipse Public License v2.0).
