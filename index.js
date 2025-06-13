const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const { getJson } = require("serpapi");
require('dotenv').config();


const app = express();
const PORT = 4000;
const API_key = process.env.API_KEY;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));


app.get("/", (req, res) => {
  res.render("index", { hospitals: null, city: null, placeType: null });
});

app.post("/search", async (req, res) => {
  const city = req.body.city || "Pune";
  const placeType = req.body.placeType || "Hospital";
  const query = `${placeType} near ${city}`;

  try {
  
    const serpApiResult = await new Promise((resolve, reject) => {
      getJson(
        {
          engine: "google",
          q: query,
          api_key: API_key, // Replace with your key
        },
        (json) => {
          json ? resolve(json) : reject("No SerpAPI response");
        }
      );
    });

    
    const mapLink = serpApiResult.local_results?.more_locations_link;
    console.log(mapLink);
   
    if (!mapLink) return res.render("index", { hospitals: [], city, placeType });

    const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
    const page = await browser.newPage();
     await page.goto(mapLink, { waitUntil: "networkidle2", timeout: 0 });
    await page.waitForSelector(".VkpGBb");
    const cards = await page.$$(".VkpGBb");

    const hospitals = [];

    for (let i = 0; i < cards.length; i++) {
      try {
        const card = cards[i];

        // Extract name BEFORE using it in console.log
        const nameText = await card.$eval(".OSrXXb", el => el.innerText).catch(() => "No name");

        // Click the anchor inside the card
        const link = await card.$("a.vwVdIc");
        if (!link) {
          console.log(`Skipping card ${i + 1}: No clickable link`);
          continue;
        }

        console.log(`➡️ Clicking card ${i + 1}: ${nameText}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        await link.click();
        await new Promise(resolve => setTimeout(resolve,  3000));
       

        // Scrape details from the panel
const details = await page.evaluate(() => {
  const name = document.querySelector("h2 span")?.innerText || "No name";

  const address =
    document.querySelector(".LrzXr")?.innerText ||
    document.querySelector('[data-attrid*="address"] span')?.innerText ||
    "No address";

  const phone =
    Array.from(document.querySelectorAll("span[aria-label]"))
      .find(el => el.getAttribute("aria-label")?.includes("Call phone number"))
      ?.innerText || "No phone";

  const website = document.querySelector("a.GFNUx")?.href || "No website";

  return { name, address, phone, website };
});


        hospitals.push(details);
        console.log(details);

        // Close side panel (Esc key)
        await page.keyboard.press("Escape");
        
      } catch (err) {
        console.log(`⚠️ Skipping card ${i + 1}: ${err.message}`);
        continue;
      }
    }

    await browser.close();
    res.render("index.ejs", { hospitals, city, placeType });
  } catch (err) {
    console.error("❌ Scraping failed:", err);
    res.render("index.ejs", { hospitals: [], city, placeType });
  }
});


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

