import { get as httpGet } from "./http.js"
import * as Diff from "diff"
import exceptions from "../exceptions/index.js";

const textURI = (tractate, daf, type) => {
  switch (type) {
    case "main": return 'https://www.sefaria.org/api/texts/' + tractate + '.' + daf + '?vhe=Wikisource_Talmud_Bavli';
    case "rashi": return 'https://www.sefaria.org/api/texts/Rashi_on_' + tractate + '.' + daf + '.1-100' + '?';
    case "tosafot": return 'https://www.sefaria.org/api/texts/Tosafot_on_' + tractate + '.' + daf + '.1-100' + '?';
  }
}
async function getText(tractate, daf, type) {
  const body = await httpGet(textURI(tractate, daf, type));
  if (body) {
    const obj = JSON.parse(body);
    return {
      english: obj.text,
      hebrew: obj.he.filter(arr => arr.length).flat().filter(str => str.length),
    }
  };
}

const lineSep = '<br>';
const sentenceSep = '|';

function merge(sefariaLines, hbLines) {
  const processHebrew = string => string
    .replace(/<[^>]*>/g, "")
    .replaceAll("–", "")
    .replaceAll("׳", "'")
    // .replace(/\([^\(\)]+\)/g, '')––

  const sefariaString = processHebrew(sefariaLines.join(sentenceSep));
  const diff = Diff.diffChars(sefariaString, hbLines.join(lineSep));
  let merged = "";
  diff.forEach((part) => {
    if (part.removed) {
      if (part.value.includes(sentenceSep))
        merged += sentenceSep;
    } else if (part.added) {
      if (part.value.includes ("]"))
        merged += "] ";
      if (part.value.includes(lineSep))
        merged += lineSep;
      if (part.value.includes("["))
        merged += "[";
    } else {
      merged += part.value;
    }
  });
  const issues = verifyMerged(merged, sefariaLines.map(processHebrew), hbLines);
  return {
    merged,
    issues
  };
}

function compareTextArrays (splitArr, originalArr) {
  const diffs = [];
  if (splitArr.length !== originalArr.length) {
    throw new Error("To compare two arrays, they must be the same size.");
  }
  for (let i = 0; i < splitArr.length; i++) {
    const currSplit = splitArr[i].trim().replaceAll('  ', ' ');
    const currOriginal = originalArr[i].trim().replaceAll('  ', ' ');
    if (currSplit != currOriginal) {
      diffs.push(i);
      console.log(i+":");
      console.log("Us      ", currSplit);
      console.log("Original", currOriginal);
      console.log();
    }
  }
  return diffs;
}

function verifyMerged (merged, sefariaArray, hbArray) {
  const splitBySentence = merged.replaceAll(lineSep, ' ').split(sentenceSep);
  const splitByLine = merged.replaceAll(sentenceSep, ' ').split(lineSep);

  console.log("SENTENCES")
  const sefariaDiffs = compareTextArrays(splitBySentence, sefariaArray);
  console.log("LINES");
  const hbDiffs = compareTextArrays(splitByLine, hbArray);
  return {
    sefaria: sefariaDiffs,
    hb: hbDiffs
  }
}

function checkForException(tractate, daf, text, sefariaLines, hbLines) {
  const exceptionObj = exceptions[tractate.toLowerCase()];
  if (exceptionObj?.[daf]?.[text]) {
    const { sefaria, hb } = exceptionObj[daf][text](sefariaLines, hbLines);
    return { sefaria, hb };
  }
  return { sefaria: sefariaLines, hb: hbLines };
}

async function mergeText(tractate, daf, text, hbLines) {
  const {hebrew} = await getText(tractate, daf, text);
  const { sefaria, hb } = checkForException(tractate, daf, text, hebrew, hbLines)
  return merge(sefaria, hb);
}
//Leave these as three separate functions for now
async function mergeMain(tractate, daf, mainLines) {
  console.log(tractate, daf, "Main");
  return await mergeText(tractate, daf, "main", mainLines)
}

async function mergeRashi(tractate, daf, rashiLines) {
  console.log(tractate, daf, "Rashi");
  return await mergeText(tractate, daf, "rashi", rashiLines)
}

async function mergeTosafot(tractate, daf, tosafotLines) {
  console.log(tractate, daf, "Rashi");
  return await mergeText(tractate, daf, "tosafot", tosafotLines)
}
export { mergeMain, mergeRashi, mergeTosafot }
