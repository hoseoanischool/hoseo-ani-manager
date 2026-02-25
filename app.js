// ====== 설정 ======
const ROOMS = ["210호", "106호", "208호", "212호"]; // 208호 추가

const SEATS_BY_ROOM = {
  "210호": Array.from({ length: 35 }, (_, i) => String(i + 1)),
  "106호": Array.from({ length: 32 }, (_, i) => String(i + 1)),
  "208호": Array.from({ length: 36 }, (_, i) => String(i + 1)), // 36석 설정
  "212호": Array.from({ length: 32 }, (_, i) => String(i + 1)),
};

// 고정 좌석 설정
const fixedSeatsByRoom = {
  "210호": {
    "1": "이채은", "7": "김지선", "9": "자나라", "10": "최수인", "11": "이현두",
    "12": "임호빈", "13": "전가람", "17": "장수선", "18": "임소연", "19": "이수빈",
    "20": "장아라", "24": "박소윤", "25": "박지혜", "27": "장시은", "28": "이현아",
  },
  "106호": { "14": "김정민" },
  "208호": {}, // 208호 고정좌석 필요시 여기에 추가
  "212호": {}
};

// 야작 금지 인원 설정
const BANNED_USERS = [
  { name: "키커바", studentId: "12340000" }
];

// CSV 복사 기능 관리자 비밀번호 (조교님이 정하신 번호로 수정하세요)
const ADMIN_PASSWORD = '0415405841-2025-2-0821'; 

const KST_OFFSET_MIN = 9 * 60; // KST +09:00

function nowKST() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + KST_OFFSET_MIN * 60000);
}

function pad2(n) { return String(n).padStart(2, "0"); }

function ymdKST(d = nowKST()) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function getWeekDatesKST(base = nowKST()) {
  const dow = base.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMon);
  monday.setHours(0,0,0,0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function labelKOR(d) {
  const w = ["일","월","화","수","목","금","토"][d.getDay()];
  return `${d.getMonth()+1}/${d.getDate()}(${w})`;
}

const $roomTabs = document.getElementById("roomTabs");
const $weekTabs = document.getElementById("weekTabs");
const $seatLayout = document.getElementById("seatLayout");
const $modal = document.getElementById("bookingModal");
const $modalTitle = document.getElementById("modalTitle");
const $modalName = document.getElementById("modalName");
const $modalStudentId = document.getElementById("modalStudentId");
const $modalPhone = document.getElementById("modalPhoneNumber");
const $modalSubmitBtn = document.getElementById("modalSubmitBtn");
const $modalCloseBtn = document.getElementById("modalCloseBtn");
const $searchName = document.getElementById("searchName");
const $searchStudentId = document.getElementById("searchStudentId");
const $searchPhone = document.getElementById("searchPhoneNumber");
const $searchBtn = document.getElementById("searchBtn");
const $reservationList = document.getElementById("reservationList");
const $copyCsvBtn = document.getElementById("copyCsvBtn");
const $activeRoomDisplay = document.getElementById("activeRoomDisplay");
const $confirmationModal = document.getElementById("confirmationModal");
const $confirmationMessage = document.getElementById("confirmationMessage");
const $confirmationCloseBtn = document.getElementById("confirmationCloseBtn");
const $openChatLinkContainer = document.getElementById("openChatLinkContainer");

let activeRoom = ROOMS[0];
let activeDate = nowKST();
let activeDateKey = ymdKST(activeDate);
let selectedSeat = null;
let bookingsRef = null;
let bookingsUnsub = null;

function renderRoomTabs() {
  $roomTabs.innerHTML = "";
  ROOMS.forEach(room => {
    const btn = document.createElement("button");
    btn.textContent = room;
    btn.className = (room === activeRoom) ? "active" : "inactive";
    btn.onclick = () => {
      activeRoom = room;
      renderRoomTabs();
      attachBookingsListener();
    };
    $roomTabs.appendChild(btn);
  });
  $activeRoomDisplay.textContent = `현재 선택: ${activeRoom}`;
}

function renderWeekTabs() {
  $weekTabs.innerHTML = "";
  const week = getWeekDatesKST(nowKST());
  week.forEach(d => {
    const btn = document.createElement("button");
    const key = ymdKST(d);
    btn.textContent = labelKOR(d);
    btn.className = (key === activeDateKey) ? "active" : "inactive";
    btn.onclick = () => {
      activeDate = new Date(d);
      activeDateKey = ymdKST(activeDate);
      renderWeekTabs();
      attachBookingsListener();
    };
    $weekTabs.appendChild(btn);
  });
}

function renderSeats(snapshotVal) {
  $seatLayout.innerHTML = "";
  const bookings = snapshotVal || {};
  const seatsInRoom = SEATS_BY_ROOM[activeRoom] || [];
  const fixedSeats = fixedSeatsByRoom[activeRoom] || {};
  const todayKey = ymdKST(nowKST());
  const isPastDate = activeDateKey < todayKey;

  $seatLayout.classList.remove("room-106", "room-210", "room-208", "room-212", "past-date");
  $seatLayout.classList.add(`room-${activeRoom.replace('호', '')}`);
  if (isPastDate) $seatLayout.classList.add("past-date");

  seatsInRoom.forEach(seat => {
    const div = document.createElement("div");
    div.className = "seat";
    div.dataset.seatNumber = seat;
    
    const fixedName = fixedSeats[seat];
    const bookedData = bookings[seat];

    if (fixedName) div.classList.add("fixed");
    if (bookedData) div.classList.add("booked");

    let nameText = fixedName ? fixedName : (bookedData ? bookedData.name : "예약 가능");
    div.innerHTML = `<strong>${seat}</strong><div class="name">${nameText}</div>`;

    if (isPastDate) {
      div.onclick = () => alert("지난 날짜는 예약 불가능 합니다");
    } else if (fixedName) {
      div.onclick = () => alert(`${activeRoom} ${seat}번은 고정 좌석(${fixedName})입니다.`);
    } else if (bookedData) {
      div.onclick = () => alert("이미 예약된 좌석입니다.");
    } else {
      div.title = "예약 가능";
      div.onclick = () => openModal(seat);
    }
    $seatLayout.appendChild(div);
  });
}

function openModal(seat) {
  selectedSeat = seat;
  $modalTitle.textContent = `${activeDateKey} · ${activeRoom} 좌석 ${seat} 예약`;
  $modal.classList.add("show");
  $modalName.focus();
}

function closeModal() {
  $modal.classList.remove("show");
}

async function submitBooking() {
  const name = $modalName.value.trim();
  const sid = $modalStudentId.value.trim();
  const phone = $modalPhone.value.trim();

  if (!selectedSeat || !name || !sid || !phone) {
    alert("이름, 학번, 나만의 4자리 숫자를 모두 입력하세요.");
    return;
  }
  
  const consentRef = db.ref(`consents/${sid}`);
  const consentSnap = await consentRef.get();
  
  if (!consentSnap.exists()) {
    const consentText = `개인 정보 수집 동의 (생략...)`;
    if (confirm(consentText)) {
      await consentRef.set({ agreedAt: Date.now() });
    } else {
      alert("동의가 필요합니다.");
      return;
    }
  }

  if (BANNED_USERS.some(user => user.studentId === sid)) {
    alert("신청 불가 기간입니다.");
    return;
  }

  if (!/^\d{8}$/.test(sid)) { alert("학번 8자리를 입력해 주세요"); return; }
  if (!/^\d{4}$/.test(phone)) { alert("4자리 숫자를 입력해 주세요"); return; }

  const bookingsSnap = await db.ref(`bookings/${activeRoom}/${activeDateKey}`).get();
  const bookings = bookingsSnap.val() || {};
  if (Object.values(bookings).some(b => b.studentId === sid)) {
    alert(`이미 다른 좌석을 예약했습니다.`);
    return;
  }

  const seatRef = db.ref(`bookings/${activeRoom}/${activeDateKey}/${selectedSeat}`);
  await seatRef.set({ name, studentId: sid, phone, createdAt: Date.now() });

  const profileName = `${activeRoom}-${selectedSeat}-${sid}-${name}`;
  closeModal();
  showConfirmationModal(profileName);
}

async function searchReservation() {
  const name = $searchName.value.trim();
  const sid = $searchStudentId.value.trim();
  const phone = $searchPhone.value.trim();

  $reservationList.innerHTML = "";
  $openChatLinkContainer.innerHTML = "";

  if (!name || !sid || !phone) { alert("모두 입력해주세요."); return; }

  const allRoomsBookings = await db.ref("bookings").get();
  const roomsData = allRoomsBookings.val() || {};
  const results = [];

  for (const [room, roomBookings] of Object.entries(roomsData)) {
    for (const [date, dayBookings] of Object.entries(roomBookings)) {
      Object.entries(dayBookings).forEach(([seat, v]) => {
        if (v.name === name && v.studentId === sid && v.phone === phone) {
          results.push({ room, date, seat, ...v });
        }
      });
    }
  }

  if (results.length === 0) { $reservationList.textContent = "내역이 없습니다."; return; }

  $openChatLinkContainer.innerHTML = `<a href="카톡방링크">▶ 오픈채팅 바로가기</a>`;

  results.forEach(res => {
    const row = document.createElement("div");
    row.className = "res-item";
    row.innerHTML = `<div><strong>${res.date}</strong> · ${res.room} ${res.seat}번</div>
                     <button onclick="cancelBooking('${res.room}','${res.date}','${res.seat}')">취소</button>`;
    $reservationList.appendChild(row);
  });
}

async function copyCsv() {
    const inputPassword = prompt("관리자 비밀번호:");
    if (inputPassword !== ADMIN_PASSWORD) { alert("틀렸습니다."); return; }
    const snap = await db.ref(`bookings/${activeRoom}/${activeDateKey}`).get();
    const data = snap.val() || {};
    const seatsInRoom = SEATS_BY_ROOM[activeRoom] || [];
    let csv = "seatId,name,studentId,phone\n";
    seatsInRoom.forEach(seat => {
      const r = data[seat] || {};
      csv += `${seat},${r.name||""},${r.studentId||""},${r.phone||""}\n`;
    });
    await navigator.clipboard.writeText(csv);
    alert("CSV 복사됨");
}

function showConfirmationModal(profileName) {
  $confirmationMessage.innerHTML = `프로필: <strong>${profileName}</strong><br><a href="카톡방링크">▶ 카톡방 입장</a>`;
  $confirmationModal.classList.add("show");
}

function closeConfirmationModal() { $confirmationModal.classList.remove("show"); }

function attachBookingsListener() {
  if (bookingsUnsub) bookingsRef.off("value", bookingsUnsub);
  bookingsRef = db.ref(`bookings/${activeRoom}/${activeDateKey}`);
  bookingsUnsub = bookingsRef.on("value", snap => renderSeats(snap.val()));
}

$modalCloseBtn.onclick = closeModal;
$modalSubmitBtn.onclick = submitBooking;
$searchBtn.onclick = searchReservation;
$copyCsvBtn.onclick = copyCsv;
$confirmationCloseBtn.onclick = closeConfirmationModal;

renderRoomTabs();
renderWeekTabs();
attachBookingsListener();