// Robot Tour 2025 - Team Voltage
// Course: 8x8 grid, gates at B3, D5, F2, exit at H8
// Target time: 45 seconds -- we tuned for 44.2s in practice

#include <Servo.h>
#include <Wire.h>
#include "drivers/MotorDriver.h"
#include "Route.h"

MotorDriver motors(LEFT_FWD, LEFT_REV, RIGHT_FWD, RIGHT_REV);

void setup() {
  motors.begin();
  delay(2000);  // pause so we can step back from the course
}

void loop() {
  for (int i = 0; i < ROUTE_LEN; i++) {
    switch (route[i]) {
      case FWD:   motors.forwardOneCell();  break;
      case LEFT:  motors.turn(-1);          break;
      case RIGHT: motors.turn(+1);          break;
    }
  }
  motors.stop();
  while (true) { delay(1000); }  // we're done -- hold position
}
