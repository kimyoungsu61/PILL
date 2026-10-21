import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

export type GardenPot = 'clay' | 'cloud' | 'sage' | 'ink';

type Props = {
  stage: number;
  variant?: number;
  pot?: GardenPot;
  size?: number;
};

const pots = {
  clay: { body: '#D9B39C', side: '#C59880', rim: '#E5C5AF', line: '#B58770', light: '#EDD3BF' },
  cloud: { body: '#E4E8ED', side: '#CFD7E0', rim: '#F1F3F6', line: '#ACB7C5', light: '#FAFBFC' },
  sage: { body: '#B6C7B8', side: '#9CB29F', rim: '#D0DCCE', line: '#809A87', light: '#E1E9DC' },
  ink: { body: '#647999', side: '#4D6383', rim: '#8094B0', line: '#C3CDDD', light: '#93A5BE' },
} as const;

const leafColors = ['#62876F', '#3E6D55', '#8AA489', '#4E7A60'] as const;

type LeafProps = {
  x: number;
  y: number;
  angle: number;
  scale?: number;
  color?: string;
  shape: number;
};

function Leaf({ x, y, angle, scale = 1, color = leafColors[0], shape }: LeafProps) {
  const outlines = [
    'M0 0 C-15 -1 -27 -13 -24 -27 C-22 -39 -7 -44 5 -36 C17 -28 16 -10 0 0Z',
    'M0 0 C-7 -11 -10 -28 -3 -42 C8 -36 17 -19 0 0Z',
    'M0 0 C-15 -6 -22 -25 -13 -40 C2 -40 16 -17 0 0Z',
  ];
  return (
    <G transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
      <Path d={outlines[shape]} fill={color} />
      <Path
        d={shape === 0 ? 'M0 -2 C-4 -13 -7 -23 -10 -30' : shape === 1 ? 'M0 -2 Q2 -19 -3 -34' : 'M0 -2 Q-2 -18 -10 -32'}
        fill="none"
        stroke="#E4EBDD"
        strokeOpacity={0.4}
        strokeWidth={1.05}
        strokeLinecap="round"
      />
    </G>
  );
}

function Blossom({ x, y, scale = 1, warm = false }: { x: number; y: number; scale?: number; warm?: boolean }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Path
        d="M0 -4 C-9 -16 0 -22 5 -13 C16 -19 21 -10 12 -5 C23 1 16 12 8 7 C5 20 -6 17 -5 7 C-19 11 -21 -1 -10 -5 C-16 -15 -6 -20 0 -4Z"
        fill={warm ? '#DCC2AD' : '#F4EBD9'}
        stroke={warm ? '#CCAD94' : '#E4D7BD'}
        strokeWidth={0.7}
      />
      <Circle cx={2} cy={-1} r={4} fill="#C1A16A" />
      <Circle cx={1} cy={-2} r={1.1} fill="#F3E3B8" />
    </G>
  );
}

/**
 * A little ceramic garden, drawn with paths so it stays crisp on the home card
 * and in the collection. Growth is additive; an uncompleted day never wilts it.
 */
export default function PlantIllustration({ stage, variant = 0, pot = 'clay', size = 160 }: Props) {
  const growth = Number.isFinite(stage) ? Math.max(0, Math.min(7, Math.floor(stage))) : 0;
  const species = Number.isFinite(variant) ? ((Math.floor(variant) % 3) + 3) % 3 : 0;
  const ceramic = pots[pot];
  const top = [160, 140, 123, 107, 86, 65, 44, 44][growth];
  const stem = '#66816A';
  const sprout = growth < 3;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 220 240"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Ellipse cx={111} cy={221} rx={48} ry={5.5} fill="#24392F" opacity={0.055} />
      <Ellipse cx={111} cy={219} rx={31} ry={2.8} fill="#24392F" opacity={0.045} />

      {/* The near rim is painted last, keeping the stem rooted inside the pot. */}
      <Ellipse cx={110} cy={164} rx={42} ry={11} fill={ceramic.rim} />
      <Ellipse cx={110} cy={163} rx={35} ry={7.5} fill="#796951" />
      <Ellipse cx={110} cy={164} rx={31} ry={5} fill="#8E7C61" />
      <Path d="M85 164l2 -1 M99 168l2 0 M127 161l2 1 M132 165l2 -1" stroke="#B6A082" strokeWidth={1.5} strokeLinecap="round" />

      {growth === 0 ? (
        <G>
          <Ellipse cx={110} cy={161} rx={4.6} ry={2.4} rotation={-18} origin="110,161" fill="#D5BB89" />
          <Path d="M107 162l6 -2" stroke="#B4996A" strokeWidth={0.8} strokeLinecap="round" />
        </G>
      ) : (
        <G>
          <Path
            d={`M110 165 C107 143 116 ${top + 35} 110 ${top}`}
            fill="none"
            stroke={stem}
            strokeWidth={sprout ? 2.5 : 3}
            strokeLinecap="round"
          />

          {growth === 1 && (
            <G>
              <Leaf x={110} y={145} angle={-52} scale={0.37} color="#799779" shape={2} />
              <Leaf x={110} y={142} angle={58} scale={0.34} color="#5C8164" shape={2} />
            </G>
          )}

          {growth >= 2 && (
            <G>
              <Path d="M111 147 Q98 137 88 135 M111 139 Q122 129 134 130" fill="none" stroke={stem} strokeWidth={1.7} strokeLinecap="round" />
              <Leaf x={90} y={136} angle={-45} scale={growth === 2 ? 0.66 : 0.84} color={leafColors[0]} shape={species} />
              <Leaf x={132} y={131} angle={55} scale={growth === 2 ? 0.66 : 0.81} color={leafColors[1]} shape={species} />
              {growth === 2 && <Path d="M110 124q-3 -8 2 -11q5 7 -2 11" fill="#9AAC85" />}
            </G>
          )}

          {growth >= 3 && (
            <G>
              <Path d="M111 128 Q100 117 93 115 M112 119 Q124 107 133 108" fill="none" stroke={stem} strokeWidth={1.7} strokeLinecap="round" />
              <Leaf x={94} y={116} angle={-33} scale={0.7} color={leafColors[2]} shape={species} />
              <Leaf x={132} y={109} angle={47} scale={0.67} color={leafColors[3]} shape={species} />
            </G>
          )}

          {growth >= 4 && (
            <G>
              <Path d="M112 110 Q99 97 93 98 M112 100 Q126 88 133 90" fill="none" stroke={stem} strokeWidth={1.6} strokeLinecap="round" />
              <Leaf x={94} y={99} angle={-48} scale={0.72} color={leafColors[1]} shape={species} />
              <Leaf x={132} y={91} angle={61} scale={0.67} color={leafColors[0]} shape={species} />
            </G>
          )}

          {growth >= 5 && (
            <G>
              <Path d="M112 89 Q100 79 97 77 M112 80 Q122 69 130 69" fill="none" stroke={stem} strokeWidth={1.5} strokeLinecap="round" />
              <Leaf x={98} y={78} angle={-36} scale={0.65} color={leafColors[2]} shape={species} />
              <Leaf x={129} y={70} angle={45} scale={0.63} color={leafColors[1]} shape={species} />
              {species === 1 && (
                <G>
                  <Leaf x={87} y={134} angle={-82} scale={0.5} color={leafColors[3]} shape={1} />
                  <Leaf x={131} y={130} angle={90} scale={0.5} color={leafColors[2]} shape={1} />
                </G>
              )}
            </G>
          )}

          {growth >= 6 && (
            <G>
              <Path d="M112 67 Q103 59 101 55 M111 58 Q118 49 122 49" fill="none" stroke={stem} strokeWidth={1.4} strokeLinecap="round" />
              <Leaf x={102} y={56} angle={-24} scale={0.52} color={leafColors[0]} shape={species} />
              <Leaf x={122} y={50} angle={37} scale={0.48} color={leafColors[2]} shape={species} />
              {growth === 6 && <Path d="M110 45q-6 -8 0 -13q7 5 0 13" fill="#B7BE91" />}
            </G>
          )}

          {growth === 7 && (
            <G>
              <Path d="M110 45 Q109 36 112 31" fill="none" stroke={stem} strokeWidth={1.4} strokeLinecap="round" />
              <Blossom x={111} y={31} scale={species === 2 ? 0.84 : 0.62} />
              {species === 0 && (
                <G>
                  <Path d="M134 89 Q149 80 150 71" fill="none" stroke={stem} strokeWidth={1.2} strokeLinecap="round" />
                  <Blossom x={150} y={69} scale={0.37} />
                </G>
              )}
              {species === 1 && (
                <G>
                  <Ellipse cx={88} cy={123} rx={3.7} ry={5.3} fill="#8D9361" rotation={-24} origin="88,123" />
                  <Ellipse cx={133} cy={98} rx={3.4} ry={5} fill="#A3A575" rotation={23} origin="133,98" />
                  <Path d="M87 120l-2 -4 M133 94l1 -3" stroke={stem} strokeWidth={1} strokeLinecap="round" />
                </G>
              )}
              {species === 2 && (
                <G>
                  <Path d="M92 98 Q74 86 75 73 M133 109 Q151 100 153 85" fill="none" stroke={stem} strokeWidth={1.3} strokeLinecap="round" />
                  <Blossom x={74} y={72} scale={0.64} warm />
                  <Blossom x={154} y={84} scale={0.58} />
                </G>
              )}
            </G>
          )}
        </G>
      )}

      <Path d="M69 166 Q110 180 151 166 L142 205 Q140 215 110 216 Q80 215 78 205Z" fill={ceramic.body} />
      <Path d="M136 172 Q144 171 151 166 L142 205 Q140 214 116 216 Q133 211 134 201Z" fill={ceramic.side} opacity={0.65} />
      <Path d="M78 177 Q80 192 84 201" fill="none" stroke={ceramic.light} strokeWidth={3} strokeLinecap="round" opacity={0.65} />
      <Path d="M69 166 Q110 180 151 166" fill="none" stroke={ceramic.rim} strokeWidth={5.5} strokeLinecap="round" />
      <Path d="M81 209 Q110 216 139 209" fill="none" stroke={ceramic.line} strokeWidth={0.7} opacity={0.4} />
      <Path
        d="M108 199v-9 M108 194q-9 -1 -9 -8q8 0 9 8 M108 190q8 -1 9 -8q-8 0 -9 8"
        fill="none"
        stroke={ceramic.line}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
      />
    </Svg>
  );
}
