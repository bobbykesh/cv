// --- CONFIGURATION ---
const API_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const MODEL_ID = "glm-5"; 

pdfjsLib.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

let rawCVText = "";

// --- 1. FILE HANDLING ---
document.getElementById('cv-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('filename').style.display = 'block';
    document.getElementById('filename').innerText = "Reading " + file.name + "...";

    try {
        if (file.type.includes('pdf')) {
            rawCVText = await extractTextFromPDF(file);
        } else {
            rawCVText = await extractTextFromDocx(file);
        }
        document.getElementById('filename').innerText = file.name + " Loaded ✓";
        document.getElementById('filename').style.color = "green";
    } catch (err) {
        console.error(err);
        document.getElementById('filename').innerText = "Error reading file";
        document.getElementById('filename').style.color = "red";
    }
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
    log.innerText = "Initializing Z.AI (GLM-5)...";

    // Strict JSON Prompt
    const systemPrompt = `You are an expert Resume Writer. Your task is to rewrite a user's CV to perfectly match a target Job Description.
    
    CRITICAL INSTRUCTIONS:
    1. Output ONLY valid JSON. No markdown, no intro text.
    2. Rewrite the Summary to be 3 sentences long, using keywords from the JD.
    3. Rewrite Experience bullets to start with strong action verbs (Achieved, Led, Developed).
    4. Ensure the JSON structure exactly matches the format below.

    JSON FORMAT:
    {
        "fullName": "String",
        "currentJobTitle": "String",
        "email": "String",
        "phone": "String",
        "location": "String",
        "summary": "String",
        "skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5", "Skill 6"],
        "experience": [
            {
                "title": "Job Title",
                "company": "Company Name",
                "date": "Date Range",
                "bullets": ["Bullet 1", "Bullet 2", "Bullet 3"]
            }
        ],
        "education": [
            {
                "school": "University Name",
                "degree": "Degree Title",
                "date": "Graduation Year"
            }
        ]
    }`;

    const userMessage = `CURRENT CV:\n${rawCVText.substring(0, 3000)}\n\nTARGET JOB DESCRIPTION:\n${jdText.substring(0, 2000)}`;

    log.innerText = "Sending request to Z.AI...";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "Accept-Language": "en-US,en"
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error ${response.status}: ${errText}`);
        }

        log.innerText = "Processing Response...";
        const data = await response.json();
        
        let content = data.choices[0].message.content;
        
        // Sanitize JSON (Remove markdown code blocks if AI adds them)
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const cvData = JSON.parse(content);
        
        log.innerText = "Rendering PDF...";
        renderCV(cvData);
        loader.style.display = 'none';

    } catch (error) {
        console.error(error);
        alert("Generation Failed:\n" + error.message);
        loader.style.display = 'none';
    }
}

// --- 3. RENDERING LOGIC ---
function renderCV(data) {
    // Header
    document.getElementById('out-name').innerText = data.fullName || "Your Name";
    document.getElementById('out-title').innerText = data.currentJobTitle || "Professional Title";
    
    const contactParts = [data.email, data.phone, data.location].filter(Boolean);
    document.getElementById('out-contact').innerHTML = contactParts.join(' <span style="color:#ffd700">•</span> ');

    // Summary
    document.getElementById('out-summary').innerText = data.summary || "";

    // Skills
    const skillsContainer = document.getElementById('out-skills');
    skillsContainer.innerHTML = '';
    if (data.skills && Array.isArray(data.skills)) {
        data.skills.slice(0, 12).forEach(skill => {
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
        filename: 'AI-Pro-CV.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}
