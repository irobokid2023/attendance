// Canonical list of program names used across Classes, Topic of the Day and curriculum import.
export const PROGRAM_OPTIONS = [
  '3D - Designing and Printing (123D) + Drone',
  '3D - Designing and Printing (TinkerCad) + Drone',
  'Advance Python Programming',
  'App Inventor (MIT)',
  'Arduino Electronics and Programming',
  'Arduino Robotics',
  'Coding (Scratch)',
  'Coding AI/Applied AI (Pictoblox)',
  'Electrics and Circuits (Breadboard Kit)',
  'Electrics and Circuits (Snap Kit)',
  'Internet of Things',
  'Lego Robotics - Ev3',
  'Lego Robotics - NxT',
  'Python and AI',
  'Python Programming',
  'Robotics and AI',
  'STEM Explorers',
  'Young Engineers',
] as const;

export type ProgramName = (typeof PROGRAM_OPTIONS)[number];
