// --- CONFIGURATION ---
pdfjsLib.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let model = null;
let cvText = "";

// Initialize Model on Load
(async () => {
    updateStatus("Loading AI Model (approx 20MB)...");
    try {
        model = await use.load();
        updateStatus("AI Model Ready. Upload CV to begin.");
    } catch (e) {
        console.error("Model load failed", e);
        updateStatus("Error loading AI. Please refresh.");
    }
})();

// --- FILE PARSING ---
document.getElementById('ats-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('filename').innerText = file.name;
    updateStatus("Reading file...");

    if (file.type.includes('pdf')) {
        cvText = await extractTextFromPDF(file);
    } else {
        cvText = await extractTextFromDocx(file);
    }
    
    // Store text for analysis
    document.getElementById('cv-text').value = cvText;
    updateStatus("File read. Paste Job Description and click Scan.");
});

// Reuse parsing logic from main script
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + '\n';
    }
    return fullText;
}

async function extractTextFromDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

function updateStatus(msg) {
    document.getElementById('status-text').innerText = msg;
}

// --- ANALYSIS CORE ---
async function runAnalysis() {
    const jobDesc = document.getElementById('job-desc').value;
    
    if(!model) return alert("Model loading...");
    if(!cvText) return alert("Please upload a CV first.");
    if(!jobDesc) return alert("Please paste a Job Description.");

    document.getElementById('loader').style.display = 'block';
    document.getElementById('results-area').style.display = 'none';
    updateStatus("Analyzing semantic match...");

    // 1. Semantic Similarity (TensorFlow.js)
    const sentences = [cvText, jobDesc];
    const embeddings = await model.embed(sentences);
    const embeddingArray = await embeddings.array();
    
    // Calculate Cosine Similarity
    const score = cosineSimilarity(embeddingArray[0], embeddingArray[1]);
    const percentage = Math.round(score * 100);

    // 2. Keyword Extraction (TF-IDF Lite)
    const missing = findMissingKeywords(cvText, jobDesc);

    // 3. Render Results
    renderResults(percentage, missing);
    
    document.getElementById('loader').style.display = 'none';
    document.getElementById('results-area').style.display = 'block';
    updateStatus("Analysis Complete.");
}

function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magA * magB);
}

function findMissingKeywords(cv, jd) {
    const stopWords = new Set(['a','an','the','and','or','but','in','on','at','to','for','of','with','is','are','was','were','be','been','by','as','it','that','this','from']);
    
    // Tokenize and clean
    const clean = (text) => text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    
    const cvWords = new Set(clean(cv));
    const jdWords = clean(jd);
    
    // Count frequencies in JD
    const frequency = {};
    jdWords.forEach(w => frequency[w] = (frequency[w] || 0) + 1);
    
    // Sort by importance (frequency)
    const sortedKeywords = Object.keys(frequency).sort((a,b) => frequency[b] - frequency[a]);
    
    // Find top missing words
    return sortedKeywords.filter(w => !cvWords.has(w)).slice(0, 10);
}

function renderResults(score, missingKeywords) {
    // Update Score UI
    const circle = document.getElementById('score-circle');
    document.getElementById('score-text').innerText = `${score}%`;
    circle.style.background = `conic-gradient(${score > 70 ? '#00b67a' : '#ff3d3c'} ${score * 3.6}deg, #eee 0deg)`;
    
    let msg = "Low match. Heavy optimization needed.";
    if(score > 50) msg = "Decent match, but missing key terms.";
    if(score > 75) msg = "Great match! Your CV is ATS ready.";
    document.getElementById('score-message').innerText = msg;

    // Render Missing Keywords
    const container = document.getElementById('missing-keywords');
    container.innerHTML = '';
    missingKeywords.forEach(word => {
        const span = document.createElement('span');
        span.className = 'keyword-tag missing';
        span.innerText = word;
        container.appendChild(span);
    });

    // Render Suggestions
    const list = document.getElementById('suggestion-list');
    list.innerHTML = '';
    
    const suggestions = [
        `Include these missing keywords in your Experience or Skills section: <strong>${missingKeywords.slice(0,3).join(", ")}</strong>`,
        "Ensure your job titles match the standard industry terms found in the description.",
        "Use bullet points for readability (ATS engines prefer standard formatting)."
    ];

    suggestions.forEach(s => {
        const li = document.createElement('li');
        li.innerHTML = s;
        li.style.marginBottom = "10px";
        list.appendChild(li);
    });
      }
