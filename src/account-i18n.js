const rows={
 auth:['Кіру','Войти','Sign in'],admin:['Әкімші','Администратор','Admin'],teacher:['Мұғалім','Учитель','Teacher'],assignments:['Тапсырмаларым','Мои задания','My assignments'],
 signOut:['Шығу','Выйти','Sign out'],synced:['Прогресс аккаунтыңда сақталады.','Прогресс сохраняется в аккаунте.','Progress is saved to your account.'],
 syncing:['Жүктелуде…','Загрузка…','Loading…'],networkError:['Серверге қосылу мүмкін болмады. Қайталап көр.','Не удалось связаться с сервером. Попробуй снова.','Could not reach the server. Please try again.'],
 requestError:['Әрекет орындалмады. Енгізілген деректерді тексер.','Не удалось выполнить действие. Проверь введённые данные.','The action failed. Check the entered details.'],
 aiError:['AI қызметі жауап бермеді. Кейінірек қайталап көр немесе әкімшіге хабарлас.','AI сервис недоступен. Попробуй позже или обратись к администратору.','The AI service is unavailable. Try again later or contact the administrator.'],
 originError:['Сайт мекенжайы сервер баптауына сәйкес емес. Әкімші APP_ORIGIN мәнін тексеруі керек.','Адрес сайта не совпадает с настройкой сервера. Администратору нужно проверить APP_ORIGIN.','The site address does not match the server configuration. Ask the administrator to check APP_ORIGIN.'],
 csrfError:['Сеансты жаңарту үшін бетті қайта жүкте.','Обнови страницу, чтобы обновить сессию.','Reload the page to refresh your session.'],
 authRequired:['Жалғастыру үшін аккаунтыңа кір.','Войди в аккаунт, чтобы продолжить.','Sign in to continue.'],
 aiUnavailable:['AI көмекші әлі қосылмаған. Әкімші серверде API кілтін баптауы керек.','AI помощник пока не подключён. Администратору нужно настроить ключ API на сервере.','The AI assistant is not connected yet. An administrator needs to configure the API key on the server.'],
 aiNote:['Хабарламаң мен осы чаттағы соңғы сұрақтар OpenAI-ға жіберіледі. Жеке деректерді жазба. AI қателесуі мүмкін: жауаптарды тексер.','Сообщение и недавняя история этого чата отправляются в OpenAI. Не указывай личные данные. AI может ошибаться: проверяй ответы.','Your message and recent chat history are sent to OpenAI. Do not share personal information. AI can make mistakes; check its answers.'],
 thinking:['Ойланып жатыр…','Думаю…','Thinking…'],liveAI:['AI','AI','AI'],
 noAi:['Қосылмаған','Не подключён','Not connected'],sessionExpired:['Сеанс аяқталды. Қайта кір.','Сессия истекла. Войди снова.','Your session expired. Please sign in again.'],
 credentialsError:['Email немесе құпиясөз қате.','Неверный email или пароль.','Incorrect email or password.'],emailExists:['Бұл email тіркелген.','Этот email уже зарегистрирован.','This email is already registered.'],rateLimited:['Сұраулар тым көп. Біраздан соң қайталап көр.','Слишком много запросов. Повтори чуть позже.','Too many requests. Please try again later.'],
 forbidden:['Бұл әрекетке рұқсатың жоқ.','Нет доступа к этому действию.','You do not have access to this action.'],
 accountChanged:['Аккаунт жаңартылды.','Аккаунт обновлён.','Account updated.'],
 refresh:['Жаңарту','Обновить','Refresh'],
 retryChat:['Хабарламаны қайта жібер','Отправить сообщение ещё раз','Send the message again'],
 adminGuard:['Соңғы әкімшіні бұғаттау немесе рөлін өзгерту мүмкін емес.','Нельзя заблокировать последнего администратора или изменить его роль.','The last active administrator cannot be disabled or demoted.']
};
export const extraStrings=Object.fromEntries(['kk','ru','en'].map((lang,i)=>[lang,Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v[i]]))]));
