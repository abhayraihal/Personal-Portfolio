import type { DynamicRayCastVehicleController } from '@dimforge/rapier3d-compat';
import { AXLE, DRIVE, SUSPENSION_DIRECTION, WHEEL, WHEELS } from './tuning.ts';

// throttle and steer are analog (-1..1) so keyboard and the touch joystick share one path.
// steer > 0 turns left.
export type DriveInput = { throttle: number; steer: number; brake: boolean; boost: boolean };
export type DriveState = { steer: number };
export const NO_INPUT: DriveInput = { throttle: 0, steer: 0, brake: false, boost: false };

export function addWheels(vc: DynamicRayCastVehicleController): void {
  WHEELS.forEach((w, i) => {
    vc.addWheel(w.position, SUSPENSION_DIRECTION, AXLE, WHEEL.restLength, WHEEL.radius);
    vc.setWheelSuspensionStiffness(i, WHEEL.stiffness);
    vc.setWheelSuspensionCompression(i, WHEEL.compression);
    vc.setWheelSuspensionRelaxation(i, WHEEL.relaxation);
    vc.setWheelMaxSuspensionTravel(i, WHEEL.maxSuspensionTravel);
    vc.setWheelMaxSuspensionForce(i, WHEEL.maxSuspensionForce);
    vc.setWheelFrictionSlip(i, WHEEL.frictionSlip);
    vc.setWheelSideFrictionStiffness(i, WHEEL.sideFrictionStiffness);
  });
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
// Engine force fades to zero at the speed cap instead of switching off abruptly.
const taper = (ratio: number) => clamp(1 - ratio * ratio, 0, 1);

// Call once per physics step, before world.step(). Returns the signed forward speed (m/s).
export function applyDrive(vc: DynamicRayCastVehicleController, input: DriveInput, state: DriveState, dt: number): number {
  const speed = vc.currentVehicleSpeed();
  const throttle = clamp(input.throttle, -1, 1);
  const steerInput = clamp(input.steer, -1, 1);

  const speedRatio = Math.min(Math.abs(speed) / DRIVE.maxSpeed, 1);
  const steerLimit = DRIVE.steerMax + (DRIVE.steerMaxAtSpeed - DRIVE.steerMax) * speedRatio;
  const target = steerInput * steerLimit;
  const rate = Math.abs(steerInput) < 0.05 ? DRIVE.steerReturnRate : DRIVE.steerRate;
  state.steer += clamp(target - state.steer, -rate * dt, rate * dt);

  let engine = 0;
  let brake = 0;
  if (input.brake) {
    brake = DRIVE.brakeImpulse;
  } else if (throttle > 0.02) {
    if (speed < -0.5) {
      brake = DRIVE.brakeImpulse;
    } else {
      const cap = input.boost ? DRIVE.boostMaxSpeed : DRIVE.maxSpeed;
      const force = DRIVE.engineForce * (input.boost ? DRIVE.boostMultiplier : 1);
      engine = force * throttle * taper(speed / cap);
    }
  } else if (throttle < -0.02) {
    if (speed > 0.5) {
      brake = DRIVE.brakeImpulse;
    } else {
      engine = DRIVE.engineForce * DRIVE.reverseMultiplier * throttle * taper(-speed / DRIVE.reverseMaxSpeed);
    }
  } else {
    brake = DRIVE.coastBrake;
  }

  WHEELS.forEach((w, i) => {
    vc.setWheelEngineForce(i, engine);
    vc.setWheelBrake(i, brake);
    vc.setWheelSteering(i, w.front ? state.steer : 0);
  });
  return speed;
}
