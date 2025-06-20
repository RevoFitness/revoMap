# REVO FITNESS CLIENT SIMPLE MAP

  - This repo has been created to serve client websites that are limited to a requirement of **x1** map location.
  ### Deployment
1. npm run build to compile the project.
2. once built convert dist/index.html to twig format (reference whats in the theme as to how it should be set up)
3. Replace the contents of templates/partial/gym-map.twig with your converted index.html in twig format.
4. Update file paths so you don't receive 404's to the css and js files found in the folder mapOpen
5. Install the plugin ACF to REST API
6. Ensure Lat and long is available in wp-json by enabling it.
7. First remove the disabled attributes from each lat long from here: /c/xampp/htdocs/revofitness.com.au/wp-content/themes/startdigital/Revo/PerfectGymClient.php (function function applyReadOnlyToFields($field))
8. Once disabled on single posts for lat/long to get exposed via api you'll need to open each gym page and click update. Once all updates are done add back lat and long to the above function.
9. Update the compiled js file to reference correct live /wp-json url e..g fetch('https://revofitness.test/wp-json/wp/v2/gyms?acf_format=standard&per_page=70') - change to fetch('https://staging.revofitness.com.au/wp-json/wp/v2/gyms?acf_format=standard&per_page=70')# revoMap
