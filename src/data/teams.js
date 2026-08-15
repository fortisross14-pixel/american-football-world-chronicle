export const NFL_TEAMS = [
  ['ARI','Arizona Cardinals','Arizona','NFC','West','#97233F','#000000'],
  ['ATL','Atlanta Falcons','Atlanta','NFC','South','#A71930','#000000'],
  ['BAL','Baltimore Ravens','Baltimore','AFC','North','#241773','#000000'],
  ['BUF','Buffalo Bills','Buffalo','AFC','East','#00338D','#C60C30'],
  ['CAR','Carolina Panthers','Carolina','NFC','South','#0085CA','#101820'],
  ['CHI','Chicago Bears','Chicago','NFC','North','#0B162A','#C83803'],
  ['CIN','Cincinnati Bengals','Cincinnati','AFC','North','#FB4F14','#000000'],
  ['CLE','Cleveland Browns','Cleveland','AFC','North','#311D00','#FF3C00'],
  ['DAL','Dallas Cowboys','Dallas','NFC','East','#003594','#869397'],
  ['DEN','Denver Broncos','Denver','AFC','West','#FB4F14','#002244'],
  ['DET','Detroit Lions','Detroit','NFC','North','#0076B6','#B0B7BC'],
  ['GB','Green Bay Packers','Green Bay','NFC','North','#203731','#FFB612'],
  ['HOU','Houston Texans','Houston','AFC','South','#03202F','#A71930'],
  ['IND','Indianapolis Colts','Indianapolis','AFC','South','#002C5F','#A2AAAD'],
  ['JAX','Jacksonville Jaguars','Jacksonville','AFC','South','#006778','#D7A22A'],
  ['KC','Kansas City Chiefs','Kansas City','AFC','West','#E31837','#FFB81C'],
  ['LV','Las Vegas Raiders','Las Vegas','AFC','West','#000000','#A5ACAF'],
  ['LAC','Los Angeles Chargers','Los Angeles','AFC','West','#0080C6','#FFC20E'],
  ['LAR','Los Angeles Rams','Los Angeles','NFC','West','#003594','#FFA300'],
  ['MIA','Miami Dolphins','Miami','AFC','East','#008E97','#FC4C02'],
  ['MIN','Minnesota Vikings','Minnesota','NFC','North','#4F2683','#FFC62F'],
  ['NE','New England Patriots','New England','AFC','East','#002244','#C60C30'],
  ['NO','New Orleans Saints','New Orleans','NFC','South','#D3BC8D','#101820'],
  ['NYG','New York Giants','New York','NFC','East','#0B2265','#A71930'],
  ['NYJ','New York Jets','New York','AFC','East','#125740','#000000'],
  ['PHI','Philadelphia Eagles','Philadelphia','NFC','East','#004C54','#A5ACAF'],
  ['PIT','Pittsburgh Steelers','Pittsburgh','AFC','North','#FFB612','#101820'],
  ['SF','San Francisco 49ers','San Francisco','NFC','West','#AA0000','#B3995D'],
  ['SEA','Seattle Seahawks','Seattle','NFC','West','#002244','#69BE28'],
  ['TB','Tampa Bay Buccaneers','Tampa Bay','NFC','South','#D50A0A','#34302B'],
  ['TEN','Tennessee Titans','Tennessee','AFC','South','#0C2340','#4B92DB'],
  ['WAS','Washington Commanders','Washington','NFC','East','#5A1414','#FFB612']
].map(([id,name,city,conference,division,primary,secondary], index) => ({
  id, name, city, conference, division, primary, secondary, league:'NFL', index
}));

export const UFL_TEAMS = [
  ['BHM','Birmingham Stallions','Birmingham','#8B1E2D','#D9B46F'],
  ['COL','Columbus Aviators','Columbus','#0A2342','#E6B84A'],
  ['DALU','Dallas Renegades','Dallas','#1B365D','#C8102E'],
  ['DC','DC Defenders','Washington','#C8102E','#FFFFFF'],
  ['HOUU','Houston Gamblers','Houston','#1C4E80','#D94F30'],
  ['LOU','Louisville Kings','Louisville','#5A2A82','#D9B650'],
  ['ORL','Orlando Storm','Orlando','#13294B','#00A3E0'],
  ['STL','St. Louis Battlehawks','St. Louis','#1E5AA8','#B9C8D6']
].map(([id,name,city,primary,secondary], index) => ({
  id, name, city, primary, secondary, league:'UFL', index
}));
