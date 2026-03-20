import xml.etree.ElementTree as ET
import math

def read_sumo_fcd(fcd_file):
    """Generator for reading floating car data (fcd) XML file."""

    # open file
    with open(fcd_file, encoding='utf-8') as f:

        # buffer containing vehicle locations per timestep
        buffer = []

        for event, elem in ET.iterparse(f):
            if elem.tag == 'vehicle' and event == 'end':
                buffer.append(elem)

            elif elem.tag == 'timestep' and event == 'end':
                # extract the necessary data
                t = float(elem.attrib['time'])
                current_vehicles = {
                    vehicle.attrib['id']: {
                        'id': vehicle.attrib['id'],
                        'x': float(vehicle.attrib['x']),
                        'y': 0,
                        'z': -float(vehicle.attrib['y']),
                        'r': -float(vehicle.attrib['angle']) / 180 * math.pi,
                        'type': vehicle.attrib.get('type', 'default')
                    }
                    for vehicle in buffer
                }

                yield (t, current_vehicles)
                buffer = []
