import cheerio from "cheerio";
import tractates from "./tractates.js";
import { get } from "./http.js";
import { mergeMain } from "./match-sefaria.js";

const uri = (mesechta, daf) => `https://hebrewbooks.org/shas.aspx?mesechta=${mesechta}&daf=${daf}&format=text`;

async function loadPage(tractateIndex, daf) {
  const body = await get(uri(tractateIndex, daf));
  if (body) {
    if (body.includes("Requested Page not found")) {
      throw "Invalid daf";
    } else {
      return body;
    }
  }
}

function incrementDaf (dafString) {
  const bIndex = dafString.indexOf('b');
  const b = bIndex > -1;
  const num = Number(b ? dafString.slice(0, bIndex) : dafString);
  if (b) {
    return String(num + 1);
  }
  return num + 'b';
}

async function* tractatePages(tractateIndex) {
  let daf = '2';
  let body;
  do {
    try {
      body = await loadPage(tractateIndex, daf);
      if (body) {
        yield {
          tractate: tractates[tractateIndex - 1],
          daf,
          body
        }
      }
      daf = incrementDaf(daf);
    } catch {
      return;
    }
  } while (body);
}

function linesArray(html) {
  let lines = [];
  if (html) {
    lines = html
      .split("\n")
      .map(line => line.trim()).filter(line => line);
  }
  return lines;
}


function processPage(page) {
  const $ = cheerio.load(page.body);

  $(".shastext2").find("span").replaceWith(function () {
    let inner = $(this).text();
    if (inner[0] == '\n') {
      inner = '\n[' + inner;
    } else {
      inner = '[' + inner;
    }
    if (inner[inner.length - 1] == '\n') {
      inner = inner + ']\n';
    } else {
      inner = inner + ']';
    }

    return inner;
  })

  const mainLines = linesArray($('.shastext2').html());
  const rashiLines = linesArray($(".shastext3").html());
  const tosafotLines = linesArray($(".shastext4").html());
  console.log(mainLines.length, rashiLines.length, tosafotLines.length);
  mergeMain(page.tractate, page.daf, mainLines).then();
}

tractatePages(1).next().then(page => processPage(page.value));
// (async () => {
//   for await (const page of tractatePages(4)) {
//     console.log(page.tractate, page.daf);
//     processPage(page);
//   }
// })();
//
