// Team Voltage's motor wrapper -- thin shim over analogWrite.
// Written from scratch for our chassis (Feb 2025).
#ifndef MOTOR_DRIVER_H
#define MOTOR_DRIVER_H

#include <Arduino.h>

// Team-tuned constants (from Apr 14 test runs)
const int CRUISE_POWER = 170;      // out of 255; 180 was too fast on carpet
const int TURN_POWER   = 140;
const int MS_PER_CELL  = 680;      // measured on practice course
const int MS_PER_90DEG = 410;      // our chassis, fully charged battery

// Motor pin assignments on our custom PCB
const int LEFT_FWD  = 5;
const int LEFT_REV  = 6;
const int RIGHT_FWD = 9;
const int RIGHT_REV = 10;

class MotorDriver {
public:
  MotorDriver(int lf, int lr, int rf, int rr)
    : _lf(lf), _lr(lr), _rf(rf), _rr(rr) {}

  void begin() {
    pinMode(_lf, OUTPUT); pinMode(_lr, OUTPUT);
    pinMode(_rf, OUTPUT); pinMode(_rr, OUTPUT);
  }

  void drive(int leftPwr, int rightPwr) {
    analogWrite(_lf, leftPwr  > 0 ?  leftPwr  : 0);
    analogWrite(_lr, leftPwr  < 0 ? -leftPwr  : 0);
    analogWrite(_rf, rightPwr > 0 ?  rightPwr : 0);
    analogWrite(_rr, rightPwr < 0 ? -rightPwr : 0);
  }

  void stop() { drive(0, 0); }

  void forwardOneCell() {
    drive(CRUISE_POWER, CRUISE_POWER);
    delay(MS_PER_CELL);
    stop();
    delay(60);  // small settle -- reduces coast overshoot
  }

  void turn(int direction) {  // -1 = left, +1 = right
    drive(direction * TURN_POWER, -direction * TURN_POWER);
    delay(MS_PER_90DEG);
    stop();
    delay(60);
  }

private:
  int _lf, _lr, _rf, _rr;
};

#endif
