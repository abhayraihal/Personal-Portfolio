// Codeforces data for handle 'bubble' (formerly abhay.raihal and yooy), fetched 2026-10-10 from the
// public Codeforces API (user.info, user.rating, user.status). Baked in so the site makes no API calls.

export type Contest = { name: string; date: string; rank: number; oldRating: number; newRating: number };

const RAW: [string, string, number, number, number][] = [
  ["Codeforces Round 702 (Div. 3)", '2021-02-16', 10773, 0, 362],
  ["Educational Codeforces Round 105 (Rated for Div. 2)", '2021-03-02', 8836, 362, 589],
  ["Educational Codeforces Round 106 (Rated for Div. 2)", '2021-03-18', 10218, 589, 741],
  ["Codeforces Round 713 (Div. 3)", '2021-04-10', 10908, 741, 823],
  ["Divide by Zero 2021 and Codeforces Round 714 (Div. 2)", '2021-04-11', 9203, 823, 816],
  ["Educational Codeforces Round 107 (Rated for Div. 2)", '2021-04-12', 8234, 816, 901],
  ["Codeforces Round 716 (Div. 2)", '2021-04-19', 9358, 901, 866],
  ["Codeforces Round 717 (Div. 2)", '2021-04-21', 9297, 866, 866],
  ["Educational Codeforces Round 108 (Rated for Div. 2)", '2021-04-29', 12349, 866, 820],
  ["Codeforces Round 719 (Div. 3)", '2021-05-05', 14278, 820, 795],
  ["Educational Codeforces Round 109 (Rated for Div. 2)", '2021-05-16', 8444, 795, 814],
  ["Codeforces Round 721 (Div. 2)", '2021-05-20', 12290, 814, 813],
  ["Codeforces Round 722 (Div. 2)", '2021-05-24', 12594, 813, 807],
  ["Educational Codeforces Round 110 (Rated for Div. 2)", '2021-06-04', 14224, 807, 780],
  ["Codeforces Round 728 (Div. 2)", '2021-06-25', 11317, 780, 786],
  ["Codeforces Round 733 (Div. 1 + Div. 2, based on VK Cup 2021 - Elimination (Engine))", '2021-07-17', 8995, 786, 815],
  ["Educational Codeforces Round 112 (Rated for Div. 2)", '2021-07-30', 9809, 815, 724],
  ["Codeforces Round 736 (Div. 2)", '2021-08-01', 5612, 724, 894],
  ["Codeforces Round 738 (Div. 2)", '2021-08-15', 5968, 894, 996],
  ["Codeforces Round 739 (Div. 3)", '2021-08-18', 6569, 996, 1034],
  ["Codeforces Round 741 (Div. 2)", '2021-08-26', 4002, 1034, 1129],
  ["Deltix Round, Summer 2021 (open for everyone, rated, Div. 1 + Div. 2)", '2021-08-29', 7434, 1129, 1092],
  ["Codeforces Round 742 (Div. 2)", '2021-09-05', 6662, 1092, 1102],
  ["Educational Codeforces Round 113 (Rated for Div. 2)", '2021-09-08', 8733, 1102, 1069],
  ["Codeforces Global Round 16", '2021-09-12', 10654, 1069, 955],
  ["Deltix Round, Autumn 2021 (open for everyone, rated, Div. 1 + Div. 2)", '2021-11-28', 4441, 955, 1017],
  ["Codeforces Round 758 (Div.1 + Div. 2)", '2021-12-11', 1740, 1017, 1203],
  ["Codeforces Round 759 (Div. 2, based on Technocup 2022 Elimination Round 3)", '2021-12-12', 6618, 1203, 1122],
  ["Codeforces Round 760 (Div. 3)", '2021-12-14', 5471, 1122, 1123],
  ["Codeforces Round 761 (Div. 2)", '2021-12-16', 5348, 1123, 1121],
  ["Educational Codeforces Round 119 (Rated for Div. 2)", '2021-12-18', 8499, 1121, 1061],
  ["Hello 2022", '2022-01-03', 6484, 1061, 1107],
  ["Codeforces Round 764 (Div. 3)", '2022-01-10', 7238, 1107, 1114],
  ["Codeforces Round 765 (Div. 2)", '2022-01-12', 4061, 1114, 1164],
  ["Codeforces Round 767 (Div. 2)", '2022-01-22', 6793, 1164, 1169],
  ["Codeforces Round 768 (Div. 2)", '2022-01-27', 6315, 1169, 1184],
  ["Codeforces Round 769 (Div. 2)", '2022-01-30', 9395, 1184, 1148],
  ["Educational Codeforces Round 122 (Rated for Div. 2)", '2022-01-31', 8614, 1148, 1125],
  ["Codeforces Round 770 (Div. 2)", '2022-02-06', 7501, 1125, 1121],
  ["Codeforces Global Round 19", '2022-02-12', 4261, 1121, 1205],
  ["Educational Codeforces Round 123 (Rated for Div. 2)", '2022-02-22', 7159, 1205, 1181],
  ["Codeforces Round 773 (Div. 2)", '2022-02-23', 1895, 1181, 1273],
  ["Codeforces Round 774 (Div. 2)", '2022-03-04', 6124, 1273, 1234],
  ["Codeforces Round 782 (Div. 2)", '2022-04-17', 6081, 1234, 1185],
  ["Codeforces Round 783 (Div. 2)", '2022-04-19', 3351, 1185, 1220],
  ["Codeforces Round 784 (Div. 4)", '2022-04-21', 697, 1220, 1336],
  ["Educational Codeforces Round 127 (Rated for Div. 2)", '2022-04-22', 4852, 1336, 1302],
  ["Codeforces Round 788 (Div. 2)", '2022-05-06', 2693, 1302, 1330],
  ["Codeforces Round 790 (Div. 4)", '2022-05-10', 1142, 1330, 1381],
  ["Educational Codeforces Round 128 (Rated for Div. 2)", '2022-05-13', 4276, 1381, 1357],
  ["Codeforces Round 791 (Div. 2)", '2022-05-14', 3811, 1357, 1334],
  ["Codeforces Round 792 (Div. 1 + Div. 2)", '2022-05-19', 8017, 1334, 1265],
  ["Codeforces Round 799 (Div. 4)", '2022-06-14', 2310, 1265, 1300],
  ["Codeforces Round 801 (Div. 2) and EPIC Institute of Technology Round", '2022-06-18', 3279, 1300, 1328],
  ["Codeforces Round 802 (Div. 2)", '2022-06-19', 3955, 1328, 1315],
  ["Codeforces Round 803 (Div. 2)", '2022-06-28', 3003, 1315, 1357],
  ["Educational Codeforces Round 131 (Rated for Div. 2)", '2022-07-08', 791, 1357, 1499],
  ["Harbour.Space Scholarship Contest 2023-2024 (Div. 1 + Div. 2)", '2023-08-26', 3429, 1499, 1503],
  ["Pinely Round 2 (Div. 1 + Div. 2)", '2023-08-30', 4644, 1503, 1472],
  ["Educational Codeforces Round 154 (Rated for Div. 2)", '2023-08-31', 2433, 1472, 1500],
  ["Codeforces Round 895 (Div. 3)", '2023-09-07', 1842, 1500, 1507],
  ["Codeforces Round 896 (Div. 2)", '2023-09-10', 1922, 1507, 1520],
  ["Codeforces Round 897 (Div. 2)", '2023-09-11', 2004, 1520, 1547],
  ["Codeforces Round 965 (Div. 2)", '2024-08-10', 1599, 1547, 1606],
  ["EPIC Institute of Technology Round August 2024 (Div. 1 + Div. 2)", '2024-08-11', 3102, 1606, 1607],
  ["Codeforces Round 966 (Div. 3)", '2024-08-13', 3666, 1607, 1569],
  ["Educational Codeforces Round 169 (Rated for Div. 2)", '2024-08-15', 1394, 1569, 1634],
  ["Codeforces Round 968 (Div. 2)", '2024-08-25', 3760, 1634, 1600],
  ["Codeforces Round 969 (Div. 2)", '2024-08-30', 2879, 1600, 1577],
  ["Codeforces Round 970 (Div. 3)", '2024-09-01', 817, 1577, 1618],
  ["Codeforces Round 972 (Div. 2)", '2024-09-14', 4274, 1618, 1572],
  ["Codeforces Round 973 (Div. 2)", '2024-09-20', 1907, 1572, 1598],
  ["Codeforces Round 974 (Div. 3)", '2024-09-21', 1946, 1598, 1582],
  ["Codeforces Round 975 (Div. 2)", '2024-09-27', 2130, 1582, 1584],
  ["Codeforces Round 976 (Div. 2) and Divide By Zero 9.0", '2024-09-29', 2884, 1584, 1576],
  ["Codeforces Round 977 (Div. 2, based on COMPFEST 16 - Final Round)", '2024-10-06', 1140, 1576, 1634],
  ["Educational Codeforces Round 170 (Rated for Div. 2)", '2024-10-14', 4330, 1634, 1583],
  ["Codeforces Round 979 (Div. 2)", '2024-10-19', 3069, 1583, 1565],
  ["Codeforces Round 981 (Div. 3)", '2024-10-24', 921, 1565, 1598],
  ["Codeforces Round 982 (Div. 2)", '2024-10-26', 2228, 1598, 1588],
  ["Codeforces Global Round 27", '2024-10-27', 5139, 1588, 1514],
  ["Educational Codeforces Round 171 (Rated for Div. 2)", '2024-10-28', 1503, 1514, 1577],
  ["Codeforces Round 983 (Div. 2)", '2024-11-01', 1335, 1577, 1629],
  ["Ethflow Round 1 (Codeforces Round 1001, Div. 1 + Div. 2)", '2025-01-26', 1320, 1629, 1719],
];

export const contests: Contest[] = RAW.map(([name, date, rank, oldRating, newRating]) => ({ name, date, rank, oldRating, newRating }));

export const codeforces = {
  handle: 'bubble',
  formerHandles: ['abhay.raihal', 'yooy'],
  url: 'https://codeforces.com/profile/bubble',
  rating: 1719,
  maxRating: 1719,
  rank: 'Expert',
  ratedContests: 84,
  distinctSolved: 952,
  topTags: [["greedy", 468], ["math", 414], ["implementation", 284], ["constructive algorithms", 255], ["brute force", 225], ["dp", 165], ["sortings", 141], ["data structures", 130], ["binary search", 106], ["number theory", 102]] as [string, number][],
  solvedByRating: [[800, 230], [900, 49], [1000, 54], [1100, 74], [1200, 79], [1300, 91], [1400, 83], [1500, 72], [1600, 69], [1700, 58], [1800, 52], [1900, 17], [2000, 9], [2100, 3], [2200, 4], [2300, 3]] as [number, number][],
};

// Codeforces rank bands (lower bound, name, colour used on codeforces.com).
export const RANK_BANDS: [number, string, string][] = [
  [0, 'Newbie', '#808080'],
  [1200, 'Pupil', '#008000'],
  [1400, 'Specialist', '#03a89e'],
  [1600, 'Expert', '#0000ff'],
  [1900, 'Candidate Master', '#aa00aa'],
];

export function rankFor(rating: number): { name: string; color: string } {
  let band = RANK_BANDS[0];
  for (const b of RANK_BANDS) if (rating >= b[0]) band = b;
  return { name: band[1], color: band[2] };
}

export const otherPlatforms = [
  { platform: 'LeetCode', handle: 'b20144', url: 'https://leetcode.com/u/b20144/', stat: '309 solved (41 easy, 181 medium, 87 hard)' },
  { platform: 'CodeChef', handle: 'abhayraihal', url: 'https://www.codechef.com/users/abhayraihal', stat: '4 star, highest rating 1985' },
];
