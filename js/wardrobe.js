function loadWardrobe() {
    try {
        return JSON.parse(localStorage.getItem("paymentWardrobe") || "[]");
    } catch {
        return [];
    }
}

function saveWardrobe(items) {
    localStorage.setItem("paymentWardrobe", JSON.stringify(items));
}

function readAndResizeImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const maxSize = 700;
                let { width, height } = img;
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = Math.round(height * (maxSize / width));
                        width = maxSize;
                    } else {
                        width = Math.round(width * (maxSize / height));
                        height = maxSize;
                    }
                }
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.75), blob }),
                    "image/jpeg",
                    0.75
                );
            };
            img.onerror = () => reject(new Error("Image illisible"));
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
