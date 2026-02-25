// --- CONFIGURATION ---
// Standard OpenAI Completion Endpoint (Often compatible with Z.ai/others)
// If Z.ai uses a different URL, change this line.
const API_URL = "https://api.z.ai/v1/chat/completions"; 
// Note: If Z.ai is strictly a wrapper, this endpoint might be different.
// Since I cannot verify Z.ai documentation, I am using the standard Chat Completion Format.

pdfjsLib.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let rawCVText = "";

// --- 1. FILE HANDLING ---
document.getElementById('cv-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('filename').style.display = 'block';
    document.getElementById('filename').innerText = "Reading " + file.name + "...";

    if (file.type.includes('pdf')) {
        rawCVText = await extractTextFromPDF(file);
    } else {
        rawCVText = await extractTextFromDocx(file);
    }
    
    document.getElementById('filename').innerText = file.name + " Loaded ✓";
});

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

// --- 2. AI GENERATION LOGIC ---
async function generateProCV() {
    const apiKey = document.getElementById('api-key').value.trim();
    const jdText = document.getElementById('jd-input').value.trim();

    if (!apiKey) return alert("Please enter your API Key.");
    if (!rawCVText) return alert("Please upload your current CV.");
    if (!jdText) return alert("Please paste the Job Description.");

    // Show Loader
    const loader = document.getElementById('pro-loader');
    const log = document.getElementById('status-log');
    loader.style.display = 'flex';
    log.innerText = "Constructing Prompt...";

    // Construct the Prompt
    const systemPrompt = `You are an expert Resume Writer and ATS Optimizer. 
    You will receive a user's current CV text and a target Job Description. 
    Your goal is to rewrite the CV to perfectly match the Job Description.
    
    RULES:
    1. Use professional, action-oriented language.
    2. Optimize for ATS keywords found in the Job Description.
    3. Return ONLY valid JSON data. No markdown, no explanations.
    
    JSON STRUCTURE:
    {
        "fullName": "String",
        "currentJobTitle": "String (Target Role)",
        "email": "String",
        "phone": "String",
        "location": "String",
        "summary": "String (3-4 sentences optimized for the role)",
        "skills": ["Array", "of", "Strings", "Top 10 Skills"],
        "experience": [
            {
                "title": "String",
                "company": "String",
                "date": "String",
                "bullets": ["Array", "of", "Optimized", "Bullet", "Points"]
            }
        ],
        "education": [
            {
                "school": "String",
                "degree": "String",
                "date": "String"
            }
        ]
    }`;

    const userMessage = `CURRENT CV:\n${rawCVText}\n\nTARGET JOB DESCRIPTION:\n${jdText}`;

    log.innerText = "Sending to AI Engine...";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo", // Or appropriate Z.ai model string
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error("API Error: " + err);
        }

        log.innerText = "Processing Response...";
        const data = await response.json();
        
        // Extract JSON from the response content
        let content = data.choices[0].message.content;
        
        // Clean cleanup if MD code blocks exist
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const cvData = JSON.parse(content);
        
        log.innerText = "Rendering PDF...";
        renderCV(cvData);
        loader.style.display = 'none';

    } catch (error) {
        console.error(error);
        alert("Generation Failed: " + error.message);
        loader.style.display = 'none';
    }
}

// --- 3. RENDERING LOGIC ---
function renderCV(data) {
    // Header
    document.getElementById('out-name').innerText = data.fullName || "Your Name";
    document.getElementById('out-title').innerText = data.currentJobTitle || "Professional";
    document.getElementById('out-contact').innerHTML = `
        <span>${data.email || ''}</span> | 
        <span>${data.phone || ''}</span> | 
        <span>${data.location || ''}</span>
    `;

    // Summary
    document.getElementById('out-summary').innerText = data.summary || "";

    // Skills
    const skillsContainer = document.getElementById('out-skills');
    skillsContainer.innerHTML = '';
    if (data.skills && Array.isArray(data.skills)) {
        data.skills.forEach(skill => {
            const span = document.createElement('span');
            span.className = 'tpl-skill-tag';
            span.innerText = skill;
            skillsContainer.appendChild(span);
        });
    }

    // Experience
    const expContainer = document.getElementById('out-experience');
    expContainer.innerHTML = '';
    if (data.experience && Array.isArray(data.experience)) {
        data.experience.forEach(job => {
            const div = document.createElement('div');
            div.className = 'tpl-job';
            
            // Build bullets
            const bulletsHtml = job.bullets.map(b => `<li>${b}</li>`).join('');

            div.innerHTML = `
                <div class="tpl-job-head">
                    <span>${job.title}</span>
                    <span>${job.date}</span>
                </div>
                <div class="tpl-job-sub">${job.company}</div>
                <ul class="tpl-list">
                    ${bulletsHtml}
                </ul>
            `;
            expContainer.appendChild(div);
        });
    }

    // Education
    const eduContainer = document.getElementById('out-education');
    eduContainer.innerHTML = '';
    if (data.education && Array.isArray(data.education)) {
        data.education.forEach(edu => {
            const div = document.createElement('div');
            div.style.marginBottom = "15px";
            div.innerHTML = `
                <div style="font-weight:700; font-size:0.95rem;">${edu.school}</div>
                <div style="font-size:0.9rem;">${edu.degree}</div>
                <div style="font-size:0.85rem; color:#666; font-style:italic;">${edu.date}</div>
            `;
            eduContainer.appendChild(div);
        });
    }
}

// --- 4. EXPORT ---
function downloadPDF() {
    const element = document.getElementById('resume-paper');
    const opt = {
        margin: 0,
        filename: 'AI-Perfect-CV.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}
