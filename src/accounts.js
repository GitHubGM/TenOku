const labels = {
 account:['Аккаунт','Аккаунт','Account'],
 signIn:['Кіру','Войти','Sign in'], signOut:['Шығу','Выйти','Sign out'],
 register:['Тіркелу','Регистрация','Create account'],
 authWelcome:['Білімге бірге қадам басайық','Давай учиться вместе','Let’s learn together'],
 authIntro:['Сабақтар мен нәтижелерің аккаунтыңда сақталады.','Уроки и результаты сохраняются в твоём аккаунте.','Your lessons and results are saved to your account.'],
 accountName:['Атың','Имя','Name'], email:['Электрондық пошта','Электронная почта','Email'], password:['Құпиясөз','Пароль','Password'],
 passwordHint:['Кемінде 12 таңба','Не менее 12 символов','At least 12 characters'],
 studentRegistration:['Тіркелгенде оқушы аккаунты ашылады.','При регистрации создаётся аккаунт ученика.','Registration creates a student account.'],
 noAccount:['Аккаунтың жоқ па?','Нет аккаунта?','Don’t have an account?'], haveAccount:['Аккаунтың бар ма?','Уже есть аккаунт?','Already have an account?'],
 pleaseWait:['Күте тұр…','Подождите…','Please wait…'],
 admin:['Әкімші','Администратор','Admin'], teacher:['Мұғалім','Учитель','Teacher'], student:['Оқушы','Ученик','Student'],
 administration:['Басқару','Управление','Administration'], teaching:['Мұғалім кабинеті','Кабинет учителя','Teacher workspace'],
 accountManagement:['Аккаунттарды басқару','Управление аккаунтами','Manage accounts'],
 createUser:['Аккаунт ашу','Создать аккаунт','Create account'], role:['Рөл','Роль','Role'], status:['Күйі','Статус','Status'], actions:['Әрекеттер','Действия','Actions'],
 enabled:['Белсенді','Активен','Active'], disabled:['Бұғатталған','Отключён','Disabled'],
 enableUser:['Белсендіру','Включить','Enable'], disableUser:['Бұғаттау','Отключить','Disable'],
 usersEmpty:['Аккаунттар табылмады.','Аккаунты не найдены.','No accounts found.'],
 assignStudents:['Оқушыларды мұғалімге бекіту','Закрепить учеников за учителем','Assign students to a teacher'],
 chooseTeacher:['Мұғалімді таңда','Выберите учителя','Choose a teacher'], chooseStudent:['Оқушыны таңда','Выберите ученика','Choose a student'],
 chooseLesson:['Сабақты таңда','Выберите урок','Choose a lesson'],
 studentRoster:['Оқушылар тізімі','Список учеников','Student roster'],
 rosterHint:['Бірнеше оқушыны таңдау үшін Ctrl немесе Command пернесін басып тұрыңыз. Таңдалған тізім мұғалімнің бұрынғы тізімін алмастырады.','Удерживайте Ctrl или Command для выбора нескольких учеников. Выбранный список заменит прежний список учителя.','Hold Ctrl or Command to select multiple students. The selection replaces the teacher’s existing roster.'],
 saveRoster:['Тізімді сақтау','Сохранить список','Save roster'],
 rosterEmpty:['Әзірге оқушылар бекітілмеген.','Ученики пока не назначены.','No students have been assigned yet.'],
 currentRosters:['Бекітілген оқушылар','Назначенные ученики','Current rosters'],
 assignedStudents:['Менің оқушыларым','Мои ученики','My students'],
 teacherIntro:['Бекітілген оқушыларыңның үлгерімін бақылап, оларға сабақ тағайында.','Следите за прогрессом назначенных учеников и задавайте им уроки.','Follow your assigned students’ progress and assign lessons.'],
 lessonAssignment:['Сабақ тағайындау','Назначить урок','Assign a lesson'],
 assignLesson:['Тағайындау','Назначить','Assign lesson'],
 assignments:['Тапсырмалар','Задания','Assignments'],
 assignmentsEmpty:['Әзірге тапсырмалар жоқ.','Заданий пока нет.','No assignments yet.'],
 completedLessons:['Аяқталған сабақтар','Пройденные уроки','Completed lessons'], testAttempts:['Тест әрекеттері','Попытки тестов','Test attempts'],
 averageAccuracy:['Жауаптардың дәлдігі','Точность ответов','Answer accuracy'],
 assignmentDone:['Аяқталды','Выполнено','Completed'], assignmentPending:['Орындалуы керек','Нужно выполнить','To do'],
 openLesson:['Сабақты ашу','Открыть урок','Open lesson'],
 unnamedUser:['Аккаунт','Аккаунт','Account'], unavailableLesson:['Сабақ қолжетімсіз','Урок недоступен','Lesson unavailable'],
 teacherAccountsNeeded:['Алдымен мұғалім мен оқушы аккаунттарын ашыңыз.','Сначала создайте аккаунты учителя и ученика.','Create teacher and student accounts first.'],
 assignedBy:['Мұғалім тапсырмасы','Задание учителя','Teacher assignment'],
 serverSaved:['Нәтижелер аккаунтыңда сақталады.','Результаты сохраняются в аккаунте.','Results are saved to your account.'],
 aiConnected:['AI қосылған','AI подключён','AI connected'],
 aiUnavailable:['AI мұғалімді қосу үшін серверге OpenAI API кілтін енгізу қажет.','Для подключения AI учителя добавьте ключ OpenAI API на сервере.','Add an OpenAI API key on the server to enable the AI tutor.'],
 aiPrivacy:['Сұрақтарың жауап алу үшін OpenAI қызметіне жіберіледі. Жеке деректерді жазба.','Ваши вопросы отправляются в OpenAI для ответа. Не вводите личные данные.','Your questions are sent to OpenAI for a response. Avoid sharing personal information.'],
 aiThinking:['Ойланып жатыр…','Думает…','Thinking…'],
 connectionError:['Сервермен байланысу мүмкін болмады. Қайта көріңіз.','Не удалось связаться с сервером. Попробуйте снова.','Could not reach the server. Please try again.'],
 accountUpdated:['Өзгерістер сақталды.','Изменения сохранены.','Changes saved.'],
 backToLearning:['Оқуға оралу','Вернуться к учёбе','Back to learning']
};

export const accountStrings = Object.fromEntries(['kk','ru','en'].map((lang,i)=>[lang,Object.fromEntries(Object.entries(labels).map(([key,values])=>[key,values[i]]))]));

const asArray = value => Array.isArray(value) ? value : [];
const roleLabel = (role,t) => ['admin','teacher','student'].includes(role) ? t(role) : t('student');
const statusMessage = (error,esc) => error ? `<p class="account-error" role="alert">${esc(error)}</p>` : '';
const busyAttr = busy => busy ? ' disabled' : '';

export function renderAuth({t,esc,mode='login',error='',busy=false}) {
 const isRegister=mode==='register';
 return `<div class="auth-page"><section class="panel auth-card"><a class="auth-brand" href="#home"><img src="./assets/logo.svg" alt=""><strong>TEÑ BILIM</strong></a><h1>${t('authWelcome')}</h1><p>${t('authIntro')}</p>${statusMessage(error,esc)}<form id="auth-form" data-mode="${isRegister?'register':'login'}" aria-busy="${Boolean(busy)}"><fieldset${busyAttr(busy)}>${isRegister?`<label for="auth-name">${t('accountName')}</label><input id="auth-name" name="name" required maxlength="80" autocomplete="name">`:''}<label for="auth-email">${t('email')}</label><input id="auth-email" type="email" name="email" required maxlength="254" autocomplete="username" autocapitalize="none" spellcheck="false"><label for="auth-password">${t('password')}</label><input id="auth-password" type="password" name="password" required ${isRegister?'minlength="12" ':''}maxlength="128" autocomplete="${isRegister?'new-password':'current-password'}"${isRegister?' aria-describedby="password-hint"':''}>${isRegister?`<small id="password-hint">${t('passwordHint')}</small><p class="form-help">${t('studentRegistration')}</p>`:''}<button type="submit" class="primary">${busy?t('pleaseWait'):isRegister?t('register'):t('signIn')}</button></fieldset></form><p class="auth-switch">${isRegister?t('haveAccount'):t('noAccount')} <button class="text-button" data-action="auth-mode" data-mode="${isRegister?'login':'register'}"${busyAttr(busy)}>${isRegister?t('signIn'):t('register')}</button></p></section></div>`;
}

export function renderAdmin({t,esc,users=[],assignments=[],busy=false,error=''}) {
 const roster=asArray(assignments), allUsers=asArray(users);
 const teachers=allUsers.filter(u=>u.role==='teacher'&&!u.disabled),students=allUsers.filter(u=>u.role==='student'&&!u.disabled);
 return `<div class="admin-page">${statusMessage(error,esc)}<section class="panel"><h2>${t('createUser')}</h2><form id="create-user-form" class="account-form" aria-busy="${Boolean(busy)}"><fieldset${busyAttr(busy)}><div class="form-grid"><div><label for="new-name">${t('accountName')}</label><input id="new-name" name="name" required maxlength="80" autocomplete="off"></div><div><label for="new-email">${t('email')}</label><input id="new-email" name="email" type="email" required maxlength="254" autocomplete="off" autocapitalize="none" spellcheck="false"></div><div><label for="new-password">${t('password')}</label><input id="new-password" name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password" aria-describedby="new-password-hint"><small id="new-password-hint">${t('passwordHint')}</small></div><div><label for="new-role">${t('role')}</label><select id="new-role" name="role">${['student','teacher','admin'].map(role=>`<option value="${role}">${t(role)}</option>`).join('')}</select></div></div><button class="primary" type="submit">${busy?t('pleaseWait'):t('createUser')}</button></fieldset></form></section><h2 class="section-title">${t('accountManagement')}</h2><section class="panel"><div class="table-scroll"><table class="account-table"><thead><tr><th scope="col">${t('accountName')}</th><th scope="col">${t('email')}</th><th scope="col">${t('role')}</th><th scope="col">${t('status')}</th><th scope="col">${t('actions')}</th></tr></thead><tbody>${allUsers.map(u=>`<tr><td>${esc(u.name||t('unnamedUser'))}</td><td>${esc(u.email||'')}</td><td><select data-user-role="${esc(u.id)}" aria-label="${t('role')}: ${esc(u.name||u.email||'')}"${busyAttr(busy)}>${['student','teacher','admin'].map(role=>`<option value="${role}"${u.role===role?' selected':''}>${t(role)}</option>`).join('')}</select></td><td><span class="user-status ${u.disabled?'inactive':'active'}">${t(u.disabled?'disabled':'enabled')}</span></td><td><button class="${u.disabled?'subtle':'danger'}" data-action="user-toggle" data-id="${esc(u.id)}" data-disabled="${u.disabled?'false':'true'}"${busyAttr(busy)}>${t(u.disabled?'enableUser':'disableUser')}</button></td></tr>`).join('')||`<tr><td colspan="5">${t('usersEmpty')}</td></tr>`}</tbody></table></div></section><h2 class="section-title">${t('assignStudents')}</h2><section class="panel">${teachers.length&&students.length?`<form id="assignment-form" class="account-form"><fieldset${busyAttr(busy)}><label for="roster-teacher">${t('teacher')}</label><select id="roster-teacher" name="teacherId" required><option value="">${t('chooseTeacher')}</option>${teachers.map(u=>`<option value="${esc(u.id)}">${esc(u.name)} · ${esc(u.email)}</option>`).join('')}</select><label for="roster-students">${t('studentRoster')}</label><select id="roster-students" name="studentIds" multiple size="${Math.min(8,Math.max(3,students.length))}" aria-describedby="roster-hint">${students.map(u=>`<option value="${esc(u.id)}">${esc(u.name)} · ${esc(u.email)}</option>`).join('')}</select><p class="form-help" id="roster-hint">${t('rosterHint')}</p><button class="primary" type="submit">${busy?t('pleaseWait'):t('saveRoster')}</button></fieldset></form>`:`<p>${t('teacherAccountsNeeded')}</p>`}<h3 class="section-title">${t('currentRosters')}</h3>${roster.length?`<ul class="roster-list">${roster.map(r=>{const teacher=allUsers.find(u=>String(u.id)===String(r.teacherId));const student=allUsers.find(u=>String(u.id)===String(r.studentId));return `<li>${esc(teacher?.name||t('teacher'))} → ${esc(student?.name||t('student'))}</li>`}).join('')}</ul>`:`<p class="empty">${t('rosterEmpty')}</p>`}</section></div>`;
}

export function renderTeacher({t,esc,students=[],assignments=[],busy=false,error='',lessons=[],loc}) {
 const pupils=asArray(students), lessonList=asArray(lessons);
 return `<div class="teacher-page"><p class="lead">${t('teacherIntro')}</p>${statusMessage(error,esc)}<h2>${t('assignedStudents')}</h2><div class="student-grid">${pupils.map(student=>{const progress=student.progress||{},done=asArray(progress.completed),attempts=asArray(progress.attempts);const totals=attempts.reduce((sum,a)=>sum+(Number(a.total)||0),0),correct=attempts.reduce((sum,a)=>sum+(Number(a.score)||0),0);return `<section class="panel student-card"><span class="badge">${roleLabel('student',t)}</span><h3>${esc(student.name||t('student'))}</h3><p>${esc(student.email||'')}</p><dl><div><dt>${t('completedLessons')}</dt><dd>${done.length}</dd></div><div><dt>${t('testAttempts')}</dt><dd>${attempts.length}</dd></div><div><dt>${t('averageAccuracy')}</dt><dd>${totals?Math.round(correct/totals*100):0}%</dd></div></dl></section>`}).join('')||`<section class="panel"><p class="empty">${t('rosterEmpty')}</p></section>`}</div>${pupils.length?`<h2 class="section-title">${t('lessonAssignment')}</h2><section class="panel"><form id="teacher-assignment-form" class="account-form"><fieldset${busyAttr(busy)}><div class="form-grid"><div><label for="assignment-student">${t('student')}</label><select id="assignment-student" name="studentId" required><option value="">${t('chooseStudent')}</option>${pupils.map(u=>`<option value="${esc(u.id)}">${esc(u.name||u.email||t('student'))}</option>`).join('')}</select></div><div><label for="assignment-lesson">${t('courses')}</label><select id="assignment-lesson" name="lessonId" required><option value="">${t('chooseLesson')}</option>${lessonList.map(l=>`<option value="${esc(l.id)}">${esc(loc(l.title))}</option>`).join('')}</select></div></div><button type="submit" class="primary">${busy?t('pleaseWait'):t('assignLesson')}</button></fieldset></form></section>`:''}<h2 class="section-title">${t('assignments')}</h2><section class="panel">${asArray(assignments).length?asArray(assignments).map(a=>{const pupil=pupils.find(s=>String(s.id)===String(a.studentId)),lesson=lessonList.find(l=>l.id===a.lessonId);return `<article class="assignment-row"><div><strong>${esc(pupil?.name||a.studentName||t('student'))}</strong><p>${lesson?esc(loc(lesson.title)):t('unavailableLesson')}</p></div><span class="badge">${t(a.completed?'assignmentDone':'assignmentPending')}</span></article>`}).join(''):`<p class="empty">${t('assignmentsEmpty')}</p>`}</section></div>`;
}

export function renderAssignments({t,esc,assignments=[],lessons=[],loc}) {
 const list=asArray(assignments),lessonList=asArray(lessons);
 return `<section class="panel student-assignments"><h2>${t('assignments')}</h2>${list.length?list.map(a=>{const lesson=lessonList.find(l=>l.id===a.lessonId);return `<article class="assignment-row"><div><small>${t('assignedBy')}</small><h3>${lesson?esc(loc(lesson.title)):t('unavailableLesson')}</h3><span class="assignment-status">${t(a.completed?'assignmentDone':'assignmentPending')}</span></div>${lesson?`<button class="subtle" data-action="lesson" data-id="${esc(lesson.id)}">${t('openLesson')} →</button>`:''}</article>`}).join(''):`<p class="empty">${t('assignmentsEmpty')}</p>`}</section>`;
}
