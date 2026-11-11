export const paths = {
  home: () => '/',
  robot: (robotId) => `/robot/${encodeURIComponent(robotId)}`,
};
