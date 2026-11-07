import { detent3d } from '@hlmnhkl/detent'

// Eight views round the upright axis. A drag to the right brings the left side round.
detent3d(document.querySelector('#lamp'), {
  faces: 'turntable',
  views: 8,
  names: ['Front', 'Front and left side', 'Left side', 'Back and left side', 'Back', 'Back and right side', 'Right side', 'Front and right side'],
  cssVar: ['--yaw', '--pitch'],
})
