// --- CONFIG ---
pdfjsLib.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let model = null;
let cvRawText = "";
let experienceBullets = []; // Parsed raw bullets

// --- INIT MODEL ---
(async () => {
    updateStatus("Loading AI Model...");
    try {
        model = await use.load();
        updateStatus("AI Ready. Upload files.");
        document.getElementById('generate-btn').disabled = false;
    } catch (e) {
        console.error(e);
        updateStatus("Error loading AI.");
    }
})();

function updateStatus(msg) {
    document.getElementById('status-text').innerText = msg;
}

// --- FILE PARSING ---
document.getElementById('ai-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('filename').innerText = file.name;
    
    if (file.type.includes('pdf')) {
        cvRawText = await extractTextFromPDF(file);
    } else {
        cvRawText = await extractTextFromDocx(file);
    }
    
    // Extract basic info immediately
    const email = cvRawText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/)?.[0] || "Email";
    const phone = cvRawText.match(/((?:\+|00)[1-9][0-9 \-\(\)\.]{7,32})|(0\d{10})/)?.[0] || "Phone";
    const name = cvRawText.split('\n')[0] || "Your Name";

    document.getElementById('cv-name').innerText = name;
    document.getElementById('cv-email').innerText = email;
    document.getElementById('cv-phone').innerText = phone;
    
    // Naive Bullet Extractor (Split by newlines, filter short lines)
    experienceBullets = cvRawText.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 20 && !l.includes('@') && !l.toLowerCase().includes('experience'));
});

// Reuse Extraction Logic
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

// --- AI GENERATION LOGIC ---
async function runAIGeneration() {
    const jdText = document.getElementById('jd-input').value;
    if (!cvRawText || !jdText) return alert("Please upload CV and paste Job Description.");

    // UI
    document.getElementById('ai-loader').style.display = 'flex';
    document.getElementById('ai-step').innerText = "Vectorizing Job Description...";

    // 1. Embed Job Description
    const jdEmbedding = await model.embed([jdText]);
    const jdVector = await jdEmbedding.array();

    // 2. Embed & Rank CV Bullets
    document.getElementById('ai-step').innerText = "Ranking Experience points...";
    
    const bulletEmbeddings = await model.embed(experienceBullets);
    const bulletVectors = await bulletEmbeddings.array();

    // Calculate scores
    const scoredBullets = experienceBullets.map((bullet, i) => {
        const score = cosineSimilarity(bulletVectors[i], jdVector[0]);
        return { text: bullet, score };
    });

    // Sort by relevance (Highest first)
    scoredBullets.sort((a, b) => b.score - a.score);

    // 3. Extract Keywords (TF-IDF Lite) for Skills & Summary
    document.getElementById('ai-step').innerText = "Extracting Keywords...";
    const keywords = extractKeywords(jdText);
    const matchedKeywords = keywords.filter(k => cvRawText.toLowerCase().includes(k));

    // 4. Construct the CV
    
    // SUMMARY (Template Injection)
    const topSkill = matchedKeywords[0] || "Software";
    const actionWord = "delivering results"; 
    const summary = `Professional with strong expertise in ${topSkill.toUpperCase()} and ${matchedKeywords[1] || 'industry tools'}. Proven track record of ${actionWord} in challenging environments. Excited to apply skills in ${matchedKeywords[2] || 'key areas'} to drive success.`;
    document.getElementById('cv-summary').innerText = summary;

    // SKILLS
    document.getElementById('cv-skills').innerText = matchedKeywords.slice(0, 15).join(' • ');

    // EXPERIENCE (Re-ordered)
    const expContainer = document.getElementById('cv-experience');
    expContainer.innerHTML = '';
    
    // Take top 50% most relevant bullets only
    const bestBullets = scoredBullets.slice(0, Math.min(10, scoredBullets.length));
    
    // Group them into a "Relevant Experience" block
    const div = document.createElement('div');
    div.className = 'cv-item';
    div.innerHTML = `
        <div class="cv-item-header">
            <span>Relevant Experience (AI Selected)</span>
        </div>
        <ul style="padding-left: 20px; font-size: 0.95rem; margin-top: 5px;">
            ${bestBullets.map(b => `<li style="margin-bottom: 5px;">${b.text}</li>`).join('')}
        </ul>
    `;
    expContainer.appendChild(div);

    // Calculate Match Score
    const avgScore = bestBullets.reduce((a, b) => a + b.score, 0) / bestBullets.length;
    const percentage = Math.round(avgScore * 100);
    
    document.getElementById('match-score').innerText = `${percentage}%`;
    document.getElementById('score-badge').style.display = 'flex';

    // Finish
    document.getElementById('ai-loader').style.display = 'none';
}

// --- UTILS ---
function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magA * magB);
}

function extractKeywords(text) {
    const stopWords = new Set(['the','and','to','of','a','in','for','with','on','is','as','an','at','by','be','are','that','or','it','from']);
    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const freq = {};
    words.forEach(w => {
        if(w.length > 3 && !stopWords.has(w)) freq[w] = (freq[w] || 0) + 1;
    });
    return Object.keys(freq).sort((a,b) => freq[b] - freq[a]);
}

function downloadPDF() {
    const element = document.getElementById('cv-document');
    const opt = {
        margin: 0,
        filename: 'tailored-cv.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}
