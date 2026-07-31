import json
from google import genai
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.llm_service import FunctionCallParams
from loguru import logger
from env_config import settings

# ── The Product & Solutions Knowledge Base ──────────────────────────────
PRODUCT_AND_SOLUTION_INFO = """
FORMAT: id | Name | desc | industries | USE WHEN | ASK | RELATED

=== SOLUTIONS ===
sol_business_security | Business Security Systems | Custom security+workforce tracking for any-size business | retail/restaurants/pharmacy/SME/office | general biz security, multi-location retail/office | # locations? industry? existing infra? | prod_bionic_xtreme_fx, sol_access_control
sol_enterprise_security | Enterprise Security Solutions | Sector-wise proactive security/access for plants & large enterprises | manufacturing/warehousing/logistics/banking/healthcare | large plant/enterprise needs more than basic access control | facility size? #sites/employees? risk concerns? | sol_access_control, sol_rfid_security
sol_rfid_security | RFID Security Solution | RFID asset tracking + automated access control | manufacturing/warehousing/logistics | tracking assets/inventory, automating card/tag access | tracking what (asset/people/vehicle)? indoor/outdoor? | prod_myrfid
sol_face_attendance | Face Recognition Attendance | Contactless face-recog attendance | corporate/manufacturing/education/healthcare | wants touchless/hygienic attendance, dislikes fingerprint contact | indoor/outdoor? headcount? mask usage? | prod_bionic_f6, prod_bionic_xtreme_fx, prod_mbas50
sol_access_control | Access Control System | Multi-factor door/gate access, tiered entry | corporate/manufacturing/banking/government | restrict/manage entry to doors/zones | #doors/gates? biometric/card/both? HR integration? | prod_bionic_xtreme_xi, prod_bionic_v7, prod_macs
sol_smart_city | Smart City Solution | Urban infra: public safety/traffic/parking | government/municipal | gov customer discusses traffic/parking/city infra | which use case? scale? | prod_mikshi
sol_airport | Airport Solution | Staff control + passenger flow for airports | aviation | customer is an airport/aviation authority | staff or passenger focus? terminal count? | —
sol_citizen_id | Citizen Identification | Gov-grade national ID/Aadhaar enrollment | government/public sector | gov needs citizen enrollment or ID verification | UIDAI certified device required? enrollment volume? | prod_aadhaar_kit, prod_mfs110, prod_mis100v2
sol_biometrics_attendance | Biometrics Attendance System | Fingerprint/iris attendance, stops buddy-punching | corporate/manufacturing/education/government | prevent attendance fraud, need biometric time tracking | modality pref? headcount? standalone or software? | prod_bionic_f6, prod_mbas30, prod_pravesh_lite, prod_minopcloud
sol_biometric_tech | Biometric Technologies | Multi-modal biometric ID platform (generic) | all | customer exploring biometrics w/o specific use case yet | end use case (attendance/access/pay/ID)? | —
sol_defence_security | Defence Security & Surveillance | Mission-critical security for defence/national protection | defence/government | customer is a defence/military org | clearance level? perimeter or personnel focus? | —
sol_port_marine_security | Port & Marine Security | Maritime surveillance + port security mgmt | maritime/ports/logistics | customer operates port/dock/marine facility | port size? vessel or personnel tracking? | —

=== PRODUCTS ===
prod_mfs110 | L1 Fingerprint Scanner MFS110 | Fingerprint Sensors | UIDAI L1 optical scanner, FAP10 | Aadhaar auth needs L1 cert | avoid if only L0/basic needed | prod_marc11, prod_aadhaar_kit
prod_mis100v2 | MIS100 V2 Iris Scanner | IRIS Sensor | Single iris scanner, Aadhaar-certified | iris verification wanted | avoid if fingerprint sufficient | prod_matisx
prod_morphs | MORPHS Slap Scanner | Biometric Enrollment | Ten-print 4-4-2 slap scanner | high-volume all-fingers capture, civil ID/law enforcement | avoid if single-finger capture enough | prod_moxa7e
prod_matisx | MATISX Dual Iris Scanner | IRIS Sensor | High-speed dual iris, mass enrollment | large-scale enrollment w/ iris modality | avoid if low-volume single-user | prod_mis100v2, prod_morphs
prod_moxa7e | MOXA7E Enrollment Device | Biometric Enrollment | Portable multi-biometric enrollment station | field/mobile enrollment | avoid if fixed desk enrollment only | prod_moxa73, prod_moxa71
prod_mvyom7 | Mvyom7 Intelligent Terminal | POS MicroATM | Rugged biometric POS, MicroATM/AEPS | banking/fintech biometric-verified cash/payment | avoid if no payment use case | prod_mt100, prod_ms20, prod_ms30
prod_mt100 | MT100 Biometric Tablet | Biometric Tablet | Industrial tablet w/ built-in fingerprint | field data collection + biometric verify | avoid if standalone sensor sufficient | prod_moxa73
prod_ms20 | MS20 Dynamic QR Sound Box | POS MicroATM | UPI payment sound box, dynamic QR+audio | merchant wants UPI payment confirmation | avoid if biometric verify is primary need | prod_ms30
prod_ms30 | MS30 Advanced Sound Box | POS MicroATM | Next-gen UPI sound box, longer battery | merchant wants upgrade over MS20 | use MS20 if budget-sensitive | prod_ms20
prod_mbas50 | MBAS50 Face Recognition | Integrated Biometric | Aadhaar-compliant face terminal, AEBAS | gov AEBAS-compliant face attendance | avoid if fingerprint-only needed | prod_mbas30, prod_mbas40
prod_mbas30 | MBAS30 Fingerprint Device | Integrated Biometric | AEBAS fingerprint terminal | gov office AEBAS fingerprint attendance | avoid if face-recog preferred | prod_mbas50, prod_mbas40
prod_mbas40 | MBAS40 Multi-Modal Device | Integrated Biometric | Fingerprint + face combined, AEBAS | wants both modalities in one AEBAS device | avoid if single modality + budget-sensitive | prod_mbas50, prod_mbas30
prod_marc10 | MARC10 Capacitive Reader | Fingerprint Sensors | Ultra-slim capacitive OEM module | OEM/manufacturer embedding slim sensor | avoid if Aadhaar L1 cert mandatory | prod_marc11
prod_marc11 | MARC11 L1 Scanner | Fingerprint Sensors | L1 certified capacitive scanner | needs L1 cert, non-optical/capacitive | avoid if optical preferred | prod_marc10, prod_mfs110
prod_melo20 | MELO20 FAP20 Device | Fingerprint Sensors | Rugged FAP20, IP65, latent-print detection | outdoor/harsh-environment capture | avoid for indoor office only | prod_mfs200
prod_melo30 | MELO30 Fingerprint Reader | Fingerprint Sensors | Large platen, FBI PIV certified | FBI PIV cert required | avoid if basic non-certified enough | prod_melo31, prod_mfs500mx
prod_melo31 | MELO31 MOSIP Reader | Fingerprint Sensors | Rugged FAP30, MOSIP-L1 compliant | national ID system built on MOSIP | avoid if non-MOSIP system | prod_melo30
prod_mfs500 | MFS500 Fingerprint Scanner | Fingerprint Sensors | NIST certified, high accuracy | NIST cert required | avoid for basic cost-sensitive attendance | prod_mfs500lx, prod_mfs500mx
prod_mfs500lx | MFS500-LX Advanced Scanner | Fingerprint Sensors | Liveness-protected, anti-spoofing | fraud/spoofing prevention stated concern | avoid for low-security/basic budget use | prod_mfs500, prod_mfs500mx
prod_mfs500mx | MFS500-MX FBI Certified | Fingerprint Sensors | FBI+STQC/Aadhaar cert, hardware crypto | both FBI cert AND hardware encryption needed | avoid for standard commercial use | prod_mfs500, prod_mfs500lx
prod_mfs200 | MFS200 Optical Scanner | Fingerprint Sensors | FAP20 industrial sensor | industrial auth, FAP20 spec | prefer MELO20 for rugged IP65 outdoor | prod_melo20
prod_bionic_xtreme_fx | BioNIC Xtreme FX | Face Recognition | Premium 3D liveness terminal | executive/VIP area, anti-spoofing face | avoid for budget mass deployment | prod_bionic_xtreme_xi, prod_bionic_f6
prod_bionic_xtreme_xi | BioNIC Xtreme XI | Face Recognition | AI ultra-fast matching, high-traffic | high foot-traffic entrance | avoid for low-traffic single-user | prod_bionic_xtreme_fx
prod_bionic_f6 | BioNIC F6 | Face Recognition | Standard contactless attendance terminal | daily attendance, no special ruggedness/security | prefer Xtreme XII for extreme environment | prod_bionic_xtreme_xii, prod_mbas50
prod_ipas_ai | IPAS-AI | Face Recognition | Face recog + integrated breath analyzer | sobriety/safety-compliance entry screening | avoid if no alcohol/safety screening need | —
prod_bionic_fp6 | BioNIC FP6 | Face Recognition | Face + fingerprint multi-modal, fallback option | wants backup modality if one biometric fails | avoid if single modality sufficient | prod_mbas40
prod_bionic_xtreme_xii | BioNIC Xtreme XII | Face Recognition | Rugged multi-biometric, outdoor/extreme | outdoor gate access, harsh weather | avoid for indoor climate-controlled office | prod_bionic_f6
prod_service_pad | Customized Service Pad | Biometric Tablet | Enterprise tablet w/ integrated sensors | portable service/verification kiosk | avoid if fixed enrollment station preferred | prod_moxa73
prod_moxa73 | Portable Biometric Tablet (MOXA73) | Biometric Tablet | Handheld enrollment/verification terminal | field agents need mobile enrollment/verify | avoid if fixed desk-based only | prod_moxa7e, prod_bio_hht
prod_moxa71 | Rugged Biometric Terminal (MOXA71) | Biometric Tablet | IP65 industrial terminal | harsh/outdoor industrial verification | avoid for standard office environment | prod_moxa73
prod_bio_hht | Bio HHT | Physical Access Control | Handheld verification device | verification away from fixed location (mobile police/field) | avoid for fixed checkpoint verification | prod_moxa73
prod_bionic_v7 | BioNIC V7 | Logical Access Control | Secure PC/network login reader | secure computer/network logins w/ biometrics | avoid if only physical door access needed | prod_bio_logon, prod_mscr100
prod_mscr100 | MSCR100 | Logical Access Control | Contactless smart card reader | customer uses smart cards for ID/login | avoid if no card-based system | prod_mscr200
prod_mscr200 | MSCR200 | Logical Access Control | Advanced smart card reader, higher security protocol | needs higher security than MSCR100 | avoid if basic card reading is enough | prod_mscr100
prod_mskb100 | MSKB100 | Logical Access Control | Keyboard w/ integrated fingerprint reader | wants all-in-one keyboard+fingerprint login | avoid if separate reader device preferred | prod_bionic_v7
prod_aadhaar_kit | Aadhaar Enrollment Kit | Aadhaar Products | Full UIDAI kit: fingerprint+iris+camera | setting up Aadhaar/UIDAI enrollment center | avoid if only single-modality device needed | prod_mfs110, prod_mis100v2
prod_multi_mabis | Multi MABIS | Software | Middleware integrating multiple biometric devices/apps | integrating several biometric devices/apps together | avoid for single device/single app use | prod_bio_logon, prod_m_authentication
prod_bio_logon | Bio Logon | Software | Biometric PC auth replacing password login | replace/strengthen password login w/ biometrics | avoid if no PC login need (physical only) | prod_bionic_v7
prod_m_authentication | M-Authentication | Software | Mobile biometric verification, remote auth | verification via mobile app/remotely | avoid if fixed-location hardware preferred | prod_multi_mabis
prod_pravesh_lite | Pravesh Lite | Software | Lightweight attendance & access software | needs software to manage attendance/access | prefer MACS/Megh PI for full enterprise platform | prod_megh_pi, prod_macs
prod_monuk | Monuk | Software | Visitor management system | digitize/track visitor entries | avoid if no visitor traffic | prod_megh_pi
prod_mensa | Mensa | Software | Canteen/cafeteria management, meal billing | employee cafeteria needing automated tracking | avoid if no canteen facility | prod_megh_pi
prod_megh_pi | Megh PI | Software | Cloud platform: attendance+visitor+canteen unified | wants one cloud platform vs separate tools | avoid if only one function needed, cost-sensitive | prod_pravesh_lite, prod_monuk, prod_mensa
prod_macs | MACS | Software | 7-module unified access control (gate/ACS/VMS/canteen/T&A) | large enterprise wants single integrated platform | avoid for single-site small biz, simple needs | prod_megh_pi
prod_mxface | MXFace SDK | Software | Face recognition API/SDK, 1:N + liveness | developer wants to build custom face recog into own software | avoid if ready-made hardware wanted, not SDK | prod_bionic_xtreme_fx
prod_mikshi | Mikshi AI Video Analytics | Software | AI video analytics on existing CCTV | has CCTV, wants AI insights w/o replacing hardware | avoid if no existing camera infra | —
prod_minopcloud | Minopcloud | Software | Cloud time & attendance, remote access | multi-branch/remote attendance management | avoid if on-premise only required | prod_pravesh_lite
prod_myrfid | MyRFID | RFID | RFID readers/tags/IoT gateways for asset tracking | tracking physical assets/inventory w/ tags | avoid if core need is biometric ID, not tracking | —
prod_moreze | Moreze Kiosks | Kiosk | Self-service kiosks: eKYC/Aadhaar auth/citizen services | unattended/self-service kiosk for ID or service tasks | avoid if staffed counter service preferred | prod_mxface
"""

# ── Tool Schema ──────────────────────────────────────────────────────────────
SCHEMA = FunctionSchema(
    name="search_products",
    description="Searches the Mantra Tech product and solutions knowledge base. IMPORTANT: Never speak the function name, parameters, or query aloud to the user. Just call the function silently.",
    properties={
        "query": {
            "type": "string",
            "description": "The requirement or product the user is asking about (e.g., 'need fingerprint scanner for Aadhaar', 'face attendance outdoor')."
        }
    },
    required=["query"],
)

# ── Tool Handler ─────────────────────────────────────────────────────────────
async def handle(params: FunctionCallParams) -> None:
    """Executes a one-shot AI query against the hardcoded product list."""
    try:
        query = params.arguments.get("query", "")
        logger.info(f"[product_tools] Executing AI Product Search for query: {query}")

        client = genai.Client(api_key=settings.gemini_api_key)
        
        system_prompt = (
            "You are a product search assistant for Mantra Tech.\n"
            f"Here is the product list:\n{PRODUCT_AND_SOLUTION_INFO}\n"
            "Based on the user's query, extract and return ONLY the most relevant products and solutions (Include Name, Description, and Why it fits). "
            "Keep your response extremely concise, just giving the facts. If nothing matches, say 'No exact match found, please escalate.'"
        )
        
        # We use the async client (`client.aio`) for the one-shot generation
        # to ensure it doesn't block the Pipecat event loop.
        # Note: We must hardcode a standard text model (like gemini-3.5-flash-lite).
        # We cannot use settings.gemini_model here because if it's set to a
        # live-preview model, Google's REST API will reject it with a 404.
        response = await client.aio.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=query,
            config={"system_instruction": system_prompt}
        )
        
        result_text = response.text
        logger.info(f"[product_tools] AI Search Result returned {len(result_text)} chars")
        await params.result_callback(result_text)

    except Exception as e:
        logger.error(f"[product_tools] Error in search_products: {e}")
        await params.result_callback("Error retrieving products. Please tell the customer we will check and get back to them.")
