# Manual Tests

## Image Rendering
1. Open `index.html` in a browser.
2. Create or edit a product with a **local** image path, e.g. `bandeja.png`. The image should render in card and list views.
3. Create or edit a product with a **remote** image URL, e.g. `https://via.placeholder.com/150`. The remote image should also render.
4. Try using a URL that begins with `javascript:` or `data:`. The image should be rejected and not displayed.
