// Hand-planned route for 2025 Regionals course.
// Planned on graph paper Apr 10, verified on practice run Apr 14.
#ifndef ROUTE_H
#define ROUTE_H

enum Move { FWD, LEFT, RIGHT };

// Start -> gate at B3 -> gate at D5 -> gate at F2 -> exit at H8
const Move route[] = {
  FWD, FWD, FWD,        // to first gate (B3)
  LEFT, FWD, FWD,       // turn up toward second gate
  RIGHT, FWD, FWD,      // through second gate (D5)
  LEFT, FWD, FWD, FWD,  // diagonal toward third gate
  RIGHT, FWD, FWD       // final stretch to exit (F2 then H8)
};

const int ROUTE_LEN = sizeof(route) / sizeof(route[0]);

#endif
