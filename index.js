const puppeteer = require("puppeteer-extra");
const fs = require("fs");

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

// query for all the divs with the data-test-id "ingredient-item-shipped"
const ingredientShippedSelector = '[data-test-id="ingredient-item-shipped"]';
const ingredientNotShippedSelector =
  '[data-test-id="ingredient-item-not-shipped"]';
const ingredientNameSelector = ".czDpDG";
const ingredientQuantitySelector = ".bmbggy";
const descriptionSelector = ".dtFvWA";
const timeSelector = ".fFYngF";
const instructionSelector = '[data-test-id="instruction-step"]';
const nutritionSelector = '[data-test-id="nutrition-step"]';

(async () => {
  const browser = await puppeteer.launch();

  const page = await browser.newPage();

  await page.setViewport({
    width: 1920,
    height: 5000,
  });
  await page.goto("https://www.hellofresh.com/recipes/calorie-smart-recipes");
  await page.waitForTimeout(3000);

  // selector for div with the data-test-id "recipe-image-card"
  const recipeCardSelector = '[data-test-id="recipe-image-card"]';

  let uniqueRecipeHrefList;

  let counter = 0;
  let finishedLoading = false;
  let currentLength = 0;
  // find the button with the data-test-id "load-more-cta" and click it until it's gone
  while (!finishedLoading) {
    try {
      await page.waitForSelector('[data-test-id="load-more-cta"]');

      await page.click('[data-test-id="load-more-cta"]');
      await page.waitForTimeout(3000);
      console.log("loading... " + counter++);

      // get the hrefs for each recipe
      const hrefList = await page.evaluate(async (selector) => {
        const elements = document.querySelectorAll(selector);

        return [...elements].map((element) => {
          const link = element.querySelector("a");
          if (
            element.textContent.includes("DINNERS") &&
            !element.textContent.includes("READYMEALS")
          ) {
            return link && link.href;
          } else {
            return null;
          }
        });
      }, recipeCardSelector);

      const recipeHrefList = hrefList.slice(0, -5);

      uniqueRecipeHrefList = [...new Set(recipeHrefList)];
      console.log(uniqueRecipeHrefList.length + " recipes found");

      if (counter >= 69) {
        finishedLoading = true;
      }

      currentLength = uniqueRecipeHrefList.length;
    } catch (error) {
      console.log("caught error");
      finishedLoading = true;
    }
  }

  let recipeData = [];

  // visit each page in a new tab and take a screenshot
  for (let i = 0; i < uniqueRecipeHrefList.length; i++) {
    if (uniqueRecipeHrefList[i]) {
      const newPage = await browser.newPage();
      await newPage.goto(uniqueRecipeHrefList[i]);
      // query for the div with the data-test-id "recipe-description"
      const recipeDescriptionSelector = '[data-test-id="recipe-description"]';
      await newPage.waitForSelector(recipeDescriptionSelector);

      // query the h1 and h2 text content inside the div
      const recipeName = await newPage.evaluate(async (selector) => {
        const element = document.querySelector(selector);
        const title = element.querySelector("h1").textContent;
        const subtitle = element.querySelector("h2").textContent;
        return { title, subtitle };
      }, recipeDescriptionSelector);

      const recipeDetails = await newPage.evaluate(
        async (
          ingredientShippedSelector,
          ingredientNotShippedSelector,
          ingredientNameSelector,
          ingredientQuantitySelector,
          instructionSelector,
          nutritionSelector,
          descriptionSelector,
          timeSelector
        ) => {
          const elements = [
            ...document.querySelectorAll(ingredientShippedSelector),
          ];

          const notShippedElements = [
            ...document.querySelectorAll(ingredientNotShippedSelector),
          ];

          elements.push(...notShippedElements);

          const ingredients = elements.map((element) => {
            const ingredientName = element.querySelector(
              ingredientNameSelector
            ).textContent;

            const ingredientQuantity = element.querySelector(
              ingredientQuantitySelector
            ).textContent;

            return { name: ingredientName, quantity: ingredientQuantity };
          });

          const instructions = [
            ...document.querySelectorAll(instructionSelector),
          ].map((element) => element.textContent.replace(/\n/g, " ").substr(1));

          const caloriesDiv = document.querySelector(nutritionSelector);

          const calories = caloriesDiv
            ? caloriesDiv.querySelector(".fFYngF").textContent
            : null;

          // find the time within the description
          const descriptionDiv = document.querySelector(descriptionSelector);

          const time = descriptionDiv
            ? descriptionDiv.querySelector(timeSelector).textContent
            : null;

          return { ingredients, instructions, calories, time };
        },
        ingredientShippedSelector,
        ingredientNotShippedSelector,
        ingredientNameSelector,
        ingredientQuantitySelector,
        instructionSelector,
        nutritionSelector,
        descriptionSelector,
        timeSelector
      );

      // // query the text content of each div
      // const ingredientList = await newPage.evaluate(async (selector) => {
      //   const elements = document.querySelectorAll(selector);

      //   return [...elements].map((element) => element.textContent);
      // }, ingredientSelector);

      recipeData.push({ ...recipeName, ...recipeDetails });

      console.log(recipeName.title + " added to recipeData");

      await newPage.close();
    }
  }

  fs.writeFile(
    "outputs/helloFreshRecipeData.json",
    JSON.stringify(recipeData),
    (err) => {
      if (err) {
        console.log(err);
      } else {
        console.log("success");
      }
    }
  );

  await browser.close();
})();
