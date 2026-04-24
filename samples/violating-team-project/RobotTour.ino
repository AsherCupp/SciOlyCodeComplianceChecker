#include <RobotTourPlanner.h>   // third-party library that plans routes

// Competition parameters -- passed to the library
const float TARGET_TIME_SEC = 45.0;
const Waypoint GATES[] = {
  {2, 3},  // Gate 1
  {4, 5},  // Gate 2
  {6, 2}   // Gate 3
};
const int NUM_GATES = 3;

RobotTourPlanner planner;

void setup() {
  planner.begin();

  // Hand the library everything it needs and let it plan the run.
  planner.setCourseSize(8, 8);
  planner.setGates(GATES, NUM_GATES);
  planner.setTargetTime(TARGET_TIME_SEC);
  planner.computeOptimalRoute();
}

void loop() {
  if (!planner.isFinished()) {
    planner.step();   // library drives motors and advances through waypoints
  }
}
