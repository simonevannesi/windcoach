# WindCoach Pro
### Dashboard Tattica per Coach su Gommone

**WindCoach Pro** è la dashboard essenziale ad altissima leggibilità studiata specificamente per l'allenatore su gommone durante le pause tra una regata e l'altra (prima delle procedure di partenza).

Si collega direttamente alla cartella Google Drive del PRO (`12Sn5_2YPEmH2ZzxTXy9Fcy8M6MZGi8Qr`) dove l'anemometro della barca comitato registra i dati ogni 30 secondi.

---

## Auto-Rilevamento del File Piu Recente

La dashboard **cerca sempre automaticamente il file con la data piu recente** presente nella cartella Google Drive:
- Ordina i file cronologicamente (es. `SsLog-31-10-2026.csv` > file precedenti).
- Se il file live `SsLog.csv` contiene registrazioni attive della giornata, si aggancia ad esso.
- In cima alla schermata viene **sempre indicato chiaramente il file in uso** (es. `FILE: SsLog-31-10-2026.csv (396 r)`).
- Ogni 30 secondi la sincronizzazione in background verifica la presenza di nuovi record o nuovi file.

---

## I 3 Dati Fondamentali (Zero Distrazioni)

In cima alla schermata è possibile selezionare con un tocco la finestra temporale di analisi: **5'**, **15'**, **30'**, **1h**.

In base all'intervallo scelto, la dashboard risponde alle 3 domande essenziali:

1. **INTENSITÀ DEL VENTO (Nodi)**:
   - Lettura istantanea a caratteri giganti (es. `11.1 KN`).
   - Tendenza: `IN CALO (-0.8 kn)`, `IN AUMENTO (+1.2 kn)` o `STABILE`.
   - Dettaglio intervallo: Media, Minimo (calo) e Massimo (raffica).

2. **DIREZIONE DEL VENTO (Gradi)**:
   - Lettura bussola istantanea (es. `46°`).
   - Tendenza di rotazione: `ROTAZIONE A DESTRA (+8°)`, `ROTAZIONE A SINISTRA (-6°)` o `DIREZIONE STABILE`.
   - Dettaglio intervallo: Media Asse, Minimo Sinistro — Massimo Destro, Ampiezza Totale Cono.

3. **RITMO ED ENTITÀ OSCILLAZIONI**:
   - **Tempo medio tra salti**: durata media delle oscillazioni (es. `~ 1.7 min`).
   - **Entità media salti**: ampiezza media dell'oscillazione rispetto all'asse (es. `±5°`).
   - **Stato fase attuale**: `Stato: in fase SINISTRA da 0.5 min` (oppure DESTRA).

---

## Modalita Piena Luce (Tasto SOLE)

Cliccando sul tasto **SOLE** in alto a destra, lo schermo passa da tema scuro a sfondo bianco ad altissimo contrasto con testo nero profondo, ideale sotto la luce diretta del sole con occhiali polarizzati.

---

## Come Usarlo

### Opzione A: Subito con il PC in Gommone (Rete Locale)
1. Avvia la dashboard con doppio click su `start_dashboard.bat` (oppure `python run.py`).
2. Collega l'iPhone all'Hotspot del PC (o entrambi alla stessa Wi-Fi).
3. Apri Safari sull'iPhone all'indirizzo:
   `http://192.168.1.15:8001`
*(Assicurati che il PC non vada in sospensione automatica a coperchio chiuso).*

### Opzione B: Su GitHub e Cloud Gratuito (PC Spento / A Casa)
Per usarla ovunque direttamente dall'iPhone con rete cellulare 4G/5G senza bisogno di avere il PC acceso:
1. Crea un repository gratuito su GitHub e carica questa cartella.
2. Collega il repository a Render.com (o Railway / Koyeb) come Web Service gratuito:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Otterrai un link pubblico HTTPS (es. `https://windcoach.onrender.com`).
4. Apri il link su iPhone, premi *Condividi* -> *Aggiungi alla schermata Home*. Funzionerà come un'app nativa a costo zero.
