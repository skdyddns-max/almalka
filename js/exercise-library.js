/* 확장 운동 라이브러리 — 기존 50개에 더해 총 200개를 제공한다.
 * 기구 분류는 운동 선택기의 빠른 필터에 사용된다. 배열 순서는 ID 안정성을 위해 append-only로 유지한다. */
const EQUIPMENT = [
  { id: 'bodyweight', name: '맨몸', emoji: '🤸' },
  { id: 'dumbbell',   name: '덤벨', emoji: '🏋️' },
  { id: 'barbell',    name: '바벨', emoji: '🏋️‍♂️' },
  { id: 'machine',    name: '머신', emoji: '⚙️' },
  { id: 'cable',      name: '케이블', emoji: '🔗' },
  { id: 'band',       name: '밴드', emoji: '〰️' },
  { id: 'kettlebell', name: '케틀벨', emoji: '🔔' },
  { id: 'cardio',     name: '유산소', emoji: '🏃' },
  { id: 'etc',        name: '기타', emoji: '🧰' },
];
const EQUIPMENT_MAP = Object.fromEntries(EQUIPMENT.map(x => [x.id, x]));

const EXERCISE_LIBRARY_GROUPS = [
  // 가슴 +20
  ['chest','bodyweight','br',['니 푸시업','인클라인 푸시업','디클라인 푸시업','와이드 푸시업','다이아몬드 푸시업','아처 푸시업']],
  ['chest','dumbbell','wr',['인클라인 덤벨 벤치프레스','디클라인 덤벨 벤치프레스','덤벨 플라이','인클라인 덤벨 플라이','덤벨 풀오버']],
  ['chest','barbell','wr',['디클라인 바벨 벤치프레스','클로즈그립 벤치프레스','플로어 프레스']],
  ['chest','machine','wr',['머신 체스트프레스','인클라인 머신 체스트프레스','스미스 벤치프레스']],
  ['chest','cable','wr',['로우 케이블 크로스오버','하이 케이블 크로스오버']],
  ['chest','band','br',['밴드 체스트프레스']],

  // 등 +25
  ['back','bodyweight','br',['친업','뉴트럴그립 풀업','와이드그립 풀업','네거티브 풀업','인버티드 로우','스캡풀업']],
  ['back','dumbbell','wr',['체스트 서포티드 덤벨 로우','인클라인 덤벨 로우','덤벨 스트레이트암 풀오버','덤벨 리버스 플라이']],
  ['back','barbell','wr',['펜들레이 로우','언더그립 바벨 로우','랜드마인 로우','랙 풀','굿모닝']],
  ['back','machine','wr',['머신 하이 로우','머신 로우','어시스트 풀업','플레이트 로드 로우']],
  ['back','cable','wr',['원암 케이블 로우','스트레이트암 풀다운','클로즈그립 랫풀다운','언더그립 랫풀다운']],
  ['back','band','br',['밴드 랫풀다운','밴드 시티드 로우']],

  // 하체 +30
  ['legs','bodyweight','br',['에어 스쿼트','점프 스쿼트','불가리안 스플릿 스쿼트','리버스 런지','워킹 런지','사이드 런지','코사크 스쿼트','싱글레그 글루트 브리지']],
  ['legs','dumbbell','wr',['덤벨 고블릿 스쿼트','덤벨 스플릿 스쿼트','덤벨 스텝업','덤벨 루마니안 데드리프트','덤벨 워킹 런지']],
  ['legs','barbell','wr',['백 스쿼트','로우바 스쿼트','스모 데드리프트','스티프레그 데드리프트','바벨 글루트 브리지']],
  ['legs','machine','wr',['핵 스쿼트','스미스 스쿼트','스미스 런지','라잉 레그 컬','시티드 레그 컬','힙 어브덕션','힙 어덕션','글루트 킥백 머신']],
  ['legs','band','br',['밴드 스쿼트','밴드 사이드 워크']],
  ['legs','kettlebell','wr',['케틀벨 스윙','케틀벨 고블릿 스쿼트']],

  // 어깨 +20
  ['shoulder','bodyweight','br',['파이크 푸시업','핸드스탠드 푸시업','월 워크']],
  ['shoulder','dumbbell','wr',['아놀드 프레스','시티드 덤벨 프레스','덤벨 업라이트 로우','덤벨 Y 레이즈','덤벨 리어델트 로우','덤벨 슈러그']],
  ['shoulder','barbell','wr',['비하인드 넥 프레스','바벨 업라이트 로우','푸시 프레스']],
  ['shoulder','machine','wr',['머신 숄더프레스','리버스 펙덱 플라이','머신 레터럴 레이즈']],
  ['shoulder','cable','wr',['케이블 레터럴 레이즈','케이블 프론트 레이즈','케이블 리어델트 플라이']],
  ['shoulder','band','br',['밴드 풀어파트','밴드 외회전']],

  // 팔 +25
  ['arm','bodyweight','br',['벤치 딥스','클로즈 푸시업','리버스그립 푸시업']],
  ['arm','dumbbell','wr',['인클라인 덤벨 컬','컨센트레이션 컬','덤벨 프리처 컬','조트맨 컬','크로스바디 해머 컬','덤벨 킥백','덤벨 스컬크러셔']],
  ['arm','barbell','wr',['EZ바 컬','리버스 바벨 컬','드래그 컬','클로즈그립 EZ바 프레스','JM 프레스']],
  ['arm','machine','wr',['머신 바이셉스 컬','머신 트라이셉스 익스텐션','어시스트 딥스']],
  ['arm','cable','wr',['케이블 컬','로프 해머 컬','하이 케이블 컬','원암 케이블 컬','로프 푸시다운','원암 케이블 푸시다운','케이블 오버헤드 익스텐션']],
  ['arm','band','br',['밴드 바이셉스 컬','밴드 트라이셉스 익스텐션']],

  // 코어 +20
  ['core','bodyweight','br',['바이시클 크런치','리버스 크런치','V업','토 터치','마운틴 클라이머','데드버그','버드독','사이드 플랭크 힙딥','홀로우 바디 홀드','슈퍼맨','윈드실드 와이퍼','드래곤 플래그']],
  ['core','cable','wr',['케이블 크런치','팔로프 프레스','케이블 우드찹','케이블 리버스 우드찹']],
  ['core','dumbbell','wr',['덤벨 사이드 밴드','덤벨 데드버그']],
  ['core','band','br',['밴드 팔로프 프레스','밴드 우드찹']],

  // 유산소 +8
  ['cardio','cardio','dist',['빠른 걷기','트레일 러닝','실내 사이클']],
  ['cardio','cardio','time',['일립티컬','에어바이크','스키에르그','배틀로프','버피']],

  // 기타 +2
  ['etc','etc','time',['전신 스트레칭','폼롤링']],
];

const EXTRA_EXERCISES = EXERCISE_LIBRARY_GROUPS.flatMap(([part, equipment, type, names], groupIndex) =>
  names.map((name, itemIndex) => ({ id: `lib_${groupIndex}_${itemIndex}`, part, equipment, type, name }))
);

function exerciseEquipment(exercise) {
  if (exercise.equipment) return exercise.equipment;
  const n = exercise.name || '';
  if (/덤벨/.test(n)) return 'dumbbell';
  if (/바벨|벤치프레스|스쿼트|데드리프트|T바/.test(n)) return 'barbell';
  if (/밴드/.test(n)) return 'band';
  if (/케이블|랫풀다운|푸시다운|페이스풀/.test(n)) return 'cable';
  if (/머신|레그프레스|익스텐션|레그 컬|펙덱|스텝밀|트레드밀|로잉/.test(n)) return exercise.part === 'cardio' ? 'cardio' : 'machine';
  if (exercise.part === 'cardio' || exercise.type === 'dist') return 'cardio';
  if (exercise.type === 'br' || exercise.type === 'time') return 'bodyweight';
  return 'etc';
}
