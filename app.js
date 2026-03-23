const canvas = document.getElementById('pitchCanvas');
const ctx = canvas.getContext('2d');
const shotList = document.getElementById('shotList');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const counter = document.getElementById('counter');
const teamFilter = document.getElementById('teamFilter');

const shots = [];
let hoveredShotIndex = null;
let activeTeamFilter = 'all';

const pitch = {
  x: 40,
  y: 20,
  width: 720,
  height: 370,
};

function getVisibleShots() {
  if (activeTeamFilter === 'all') {
    return shots;
  }

  return shots.filter((shot) => shot.team === activeTeamFilter);
}

function drawPitch() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const scaleX = pitch.width / 68;
  const scaleY = pitch.height / 35;

  ctx.fillStyle = '#2d8f45';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#339c50';
  ctx.fillRect(pitch.x, pitch.y, pitch.width, pitch.height);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;

  ctx.strokeRect(pitch.x, pitch.y, pitch.width, pitch.height);

  ctx.beginPath();
  ctx.moveTo(pitch.x, pitch.y);
  ctx.lineTo(pitch.x + pitch.width, pitch.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pitch.x, pitch.y + pitch.height);
  ctx.lineTo(pitch.x + pitch.width, pitch.y + pitch.height);
  ctx.stroke();

  const penaltyAreaWidth = 40.32 * scaleX;
  const penaltyAreaDepth = 16.5 * scaleY;
  const penaltyAreaX = pitch.x + (pitch.width - penaltyAreaWidth) / 2;
  ctx.strokeRect(penaltyAreaX, pitch.y, penaltyAreaWidth, penaltyAreaDepth);

  const goalAreaWidth = 18.32 * scaleX;
  const goalAreaDepth = 5.5 * scaleY;
  const goalAreaX = pitch.x + (pitch.width - goalAreaWidth) / 2;
  ctx.strokeRect(goalAreaX, pitch.y, goalAreaWidth, goalAreaDepth);

  const goalWidth = 7.32 * scaleX;
  const goalDepth = 2.2 * scaleY;
  const goalX = pitch.x + (pitch.width - goalWidth) / 2;
  ctx.strokeRect(goalX, pitch.y - goalDepth, goalWidth, goalDepth);

  const penaltySpotX = pitch.x + pitch.width / 2;
  const penaltySpotY = pitch.y + 11 * scaleY;
  ctx.beginPath();
  ctx.arc(penaltySpotX, penaltySpotY, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(penaltySpotX, penaltySpotY, 9.15 * scaleY, 0.23 * Math.PI, 0.77 * Math.PI, false);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '14px Arial';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('granica tercji finałowej', pitch.x + pitch.width - 8, pitch.y + pitch.height - 6);

  const visibleShots = getVisibleShots();

  visibleShots.forEach((shot) => {
    const originalIndex = shots.indexOf(shot);
    const isHovered = originalIndex === hoveredShotIndex;
    drawShot(shot.x, shot.y, originalIndex + 1, isHovered, shot.team);
  });
}

function drawShot(x, y, number, isHovered = false, team = 'ourTeam') {
  const radius = isHovered ? 12 : 8;
  const fontSize = isHovered ? 14 : 11;
  const lineWidth = isHovered ? 3 : 2;
  const fillColor = team === 'opponent' ? '#2563eb' : '#e11d48';

  ctx.beginPath();
  ctx.fillStyle = fillColor;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), x, y + 0.5);
}

function renderShotsList() {
  const visibleShots = getVisibleShots();
  counter.textContent = String(visibleShots.length);

  if (visibleShots.length === 0) {
    shotList.innerHTML = '<div class="empty">Brak uderzeń dla wybranego filtra.</div>';
    return;
  }

  shotList.innerHTML = visibleShots
    .map((shot) => {
      const index = shots.indexOf(shot);
      return `
      <div class="shot-item" data-index="${index}">
        <strong>Uderzenie ${index + 1}</strong>
        <div class="shot-meta">
          <div>X: ${shot.contextX} m</div>
          <div>Y: ${shot.contextY} m</div>
          <div>Układ: (0,0) = lewa krawędź pola karnego na linii końcowej</div>
        </div>
        <div class="shot-fields">
          <div class="shot-field">
            <label for="timestamp-${index}">Timestamp</label>
            <input id="timestamp-${index}" type="text" class="shot-text-input" data-index="${index}" data-field="timestamp" value="${shot.timestamp || ''}" placeholder="np. 00:12:34" />
          </div>
          <div class="shot-field">
            <label for="match-time-${index}">Czas meczu</label>
            <input id="match-time-${index}" type="text" class="shot-text-input" data-index="${index}" data-field="matchTime" value="${shot.matchTime || ''}" placeholder="np. 67:15" />
          </div>
          <div class="shot-field">
            <label for="player-${index}">Nr zawodnika</label>
            <input id="player-${index}" type="text" class="shot-text-input" data-index="${index}" data-field="playerNumber" value="${shot.playerNumber || ''}" placeholder="np. 9" />
          </div>
          <div class="shot-field">
            <label for="passer-${index}">Nr zawodnika podającego</label>
            <input id="passer-${index}" type="text" class="shot-text-input" data-index="${index}" data-field="passerNumber" value="${shot.passerNumber || ''}" placeholder="np. 10" />
          </div>
          <div class="shot-field">
            <label for="xg-${index}">xG</label>
            <input id="xg-${index}" type="text" class="shot-text-input" data-index="${index}" data-field="xg" value="${shot.xg || ''}" placeholder="np. 0.18" />
          </div>
        </div>
        <div class="shot-team">
          <label class="shot-checkbox" for="team-home-${index}">
            <input id="team-home-${index}" type="checkbox" class="shot-team-checkbox" data-index="${index}" data-team="ourTeam" ${shot.team === 'ourTeam' ? 'checked' : ''} />
            Nasz zespół
          </label>
          <label class="shot-checkbox" for="team-opponent-${index}">
            <input id="team-opponent-${index}" type="checkbox" class="shot-team-checkbox" data-index="${index}" data-team="opponent" ${shot.team === 'opponent' ? 'checked' : ''} />
            Przeciwnik
          </label>
        </div>
        <div class="shot-actions">
          <select data-index="${index}" class="shot-status-select">
            <option value="gol" ${shot.status === 'gol' ? 'selected' : ''}>GOL</option>
            <option value="zablokowany" ${shot.status === 'zablokowany' ? 'selected' : ''}>Zablokowany</option>
            <option value="niecelny" ${shot.status === 'niecelny' ? 'selected' : ''}>Niecelny</option>
            <option value="dosrodkowanie" ${shot.status === 'dosrodkowanie' ? 'selected' : ''}>Dośrodkowanie</option>
            <option value="uderzenie-glowa" ${shot.status === 'uderzenie-glowa' ? 'selected' : ''}>Uderzenie głową</option>
            <option value="z-powietrza-noga" ${shot.status === 'z-powietrza-noga' ? 'selected' : ''}>Z powietrza nogą</option>
            <option value="1-kontakt" ${shot.status === '1-kontakt' ? 'selected' : ''}>1 kontakt</option>
            <option value="zza-pk" ${shot.status === 'zza-pk' ? 'selected' : ''}>Zza PK</option>
            <option value="rzut-karny" ${shot.status === 'rzut-karny' ? 'selected' : ''}>Rzut karny</option>
            <option value="interwencja-bramkarza" ${shot.status === 'interwencja-bramkarza' ? 'selected' : ''}>Interwencja bramkarza</option>
            <option value="po-bledzie-indywidualnym" ${shot.status === 'po-bledzie-indywidualnym' ? 'selected' : ''}>Po błędzie indywidualnym</option>
          </select>
          <button type="button" class="delete-shot-btn" data-index="${index}">Usuń</button>
        </div>
      </div>
    `;
    })
    .join('');
}

function getCanvasCoordinates(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  return { x, y };
}

function isInsidePitch(x, y) {
  return (
    x >= pitch.x &&
    x <= pitch.x + pitch.width &&
    y >= pitch.y &&
    y <= pitch.y + pitch.height
  );
}

function createShot(x, y) {
  const scaleX = pitch.width / 68;
  const scaleY = pitch.height / 35;
  const penaltyAreaLeftX = pitch.x + ((68 - 40.32) / 2) * scaleX;
  const originX = penaltyAreaLeftX;
  const originY = pitch.y;

  return {
    x,
    y,
    contextX: ((x - originX) / scaleX).toFixed(2),
    contextY: ((y - originY) / scaleY).toFixed(2),
    status: 'niecelny',
    timestamp: '',
    matchTime: '',
    playerNumber: '',
    passerNumber: '',
    xg: '',
    team: 'ourTeam',
  };
}

function downloadCsv(filename, content) {
  const csvWithBom = '\uFEFF' + content;
  const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportShotsToCsv() {
  if (shots.length === 0) {
    alert('Brak uderzeń do eksportu.');
    return;
  }

  const headers = [
    'id',
    'contextX',
    'contextY',
    'status',
    'timestamp',
    'matchTime',
    'playerNumber',
    'passerNumber',
    'xg',
    'team'
  ];

  const escapeCsvValue = (value) => {
    const stringValue = String(value ?? '');
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const lines = [];
  lines.push(headers.map(escapeCsvValue).join(','));

  shots.forEach((shot, index) => {
    const row = [
      index + 1,
      shot.contextX,
      shot.contextY,
      shot.status,
      shot.timestamp,
      shot.matchTime,
      shot.playerNumber,
      shot.passerNumber,
      shot.xg,
      shot.team,
    ];

    lines.push(row.map(escapeCsvValue).join(','));
  });

  const csvContent = lines.join('\n');
  const filenameDate = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadCsv(`uderzenia-${filenameDate}.csv`, csvContent);
}

canvas.addEventListener('click', (event) => {
  const { x, y } = getCanvasCoordinates(event);

  if (!isInsidePitch(x, y)) return;

  shots.push(createShot(x, y));
  drawPitch();
  renderShotsList();
});

clearBtn.addEventListener('click', () => {
  shots.length = 0;
  hoveredShotIndex = null;
  drawPitch();
  renderShotsList();
});

exportBtn.addEventListener('click', exportShotsToCsv);

teamFilter.addEventListener('change', (event) => {
  activeTeamFilter = event.target.value;
  hoveredShotIndex = null;
  drawPitch();
  renderShotsList();
});

shotList.addEventListener('click', (event) => {
  const deleteButton = event.target.closest('.delete-shot-btn');
  if (!deleteButton) return;

  const index = Number(deleteButton.dataset.index);
  shots.splice(index, 1);

  if (hoveredShotIndex === index) {
    hoveredShotIndex = null;
  } else if (hoveredShotIndex !== null && hoveredShotIndex > index) {
    hoveredShotIndex -= 1;
  }

  drawPitch();
  renderShotsList();
});

shotList.addEventListener('change', (event) => {
  const select = event.target.closest('.shot-status-select');
  if (select) {
    const index = Number(select.dataset.index);
    if (shots[index]) {
      shots[index].status = select.value;
    }
    return;
  }

  const checkbox = event.target.closest('.shot-team-checkbox');
  if (checkbox) {
    const index = Number(checkbox.dataset.index);
    const team = checkbox.dataset.team;

    if (shots[index]) {
      shots[index].team = checkbox.checked ? team : 'ourTeam';
      renderShotsList();
    }
    return;
  }

  const input = event.target.closest('.shot-text-input');
  if (!input) return;

  const index = Number(input.dataset.index);
  const field = input.dataset.field;
  if (shots[index]) {
    shots[index][field] = input.value;
  }
});

shotList.addEventListener('input', (event) => {
  const input = event.target.closest('.shot-text-input');
  if (!input) return;

  const index = Number(input.dataset.index);
  const field = input.dataset.field;
  if (shots[index]) {
    shots[index][field] = input.value;
  }
});

shotList.addEventListener('mouseover', (event) => {
  const shotItem = event.target.closest('.shot-item');
  if (!shotItem) return;

  hoveredShotIndex = Number(shotItem.dataset.index);
  drawPitch();
});

shotList.addEventListener('mouseout', (event) => {
  const shotItem = event.target.closest('.shot-item');
  if (!shotItem) return;

  const relatedTarget = event.relatedTarget;
  if (relatedTarget && shotItem.contains(relatedTarget)) return;

  hoveredShotIndex = null;
  drawPitch();
});

drawPitch();
renderShotsList();
