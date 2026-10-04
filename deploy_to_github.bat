@echo off
chcp 65001 >nul
cls
echo ========================================================
echo   ANKORIS - GITHUB PAGES OTOMATİK YAYINLAMA ARACI
echo ========================================================
echo.
echo Bu araç Ankoris uygulamasını GitHub'a yükler ve
echo 7/24 bilgisayarınız KAPALIYKEN bile telefonunuzdan
echo kesintisiz çalışmasını sağlar!
echo.
echo --------------------------------------------------------
echo 1. github.com adresinde oturum açın.
echo 2. "New repository" diyerek yeni bir depo oluşturun (örn: ankoris).
echo 3. Depo linkini kopyalayın (örn: https://github.com/kullanici/ankoris.git)
echo --------------------------------------------------------
echo.
set /p REPO_URL="GitHub Depo Linkini Buraya Yapıştırın ve Enter'a Basın: "

if "%REPO_URL%"=="" (
    echo.
    echo [HATA] Bir repo linki girmediniz. İşlem iptal edildi.
    pause
    exit /b
)

echo.
echo [1/3] Değişiklikler paketleniyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '%USERPROFILE%\git_portable\cmd\git.exe' add ."
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '%USERPROFILE%\git_portable\cmd\git.exe' commit -m 'Ankoris Otomatik Guncelleme' 2>nul"

echo [2/3] GitHub bağlantısı kuruluyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '%USERPROFILE%\git_portable\cmd\git.exe' remote remove origin 2>nul"
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '%USERPROFILE%\git_portable\cmd\git.exe' remote add origin '%REPO_URL%'"
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '%USERPROFILE%\git_portable\cmd\git.exe' branch -M main"

echo [3/3] GitHub'a yükleniyor (git push)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "& '%USERPROFILE%\git_portable\cmd\git.exe' push -u origin main --force"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   TEBRİKLER! YÜKLEME BAŞARIYLA TAMAMLANDI!
    echo ========================================================
    echo.
    echo GitHub Pages'i etkinleştirmek için:
    echo 1. GitHub reponuzda "Settings" ^> "Pages" bölümüne gidin.
    echo 2. "Build and deployment" ^> Source kısmından:
    echo    - İster "GitHub Actions" seçin (Otomatik yayına girer),
    echo    - İster "Deploy from a branch" ^> "main" / "/docs" seçip Save deyin.
    echo.
    echo Birkaç dakika içinde uygulamanız:
    echo https://kullanici-adiniz.github.io/reponuz/
    echo adresinde 7/24 ve bilgisayarınız KAPALIYKEN çalışacaktır!
    echo ========================================================
) else (
    echo.
    echo [UYARI] Yükleme sırasında bir durum oluştu.
    echo Lütfen GitHub kullanıcı adı / şifre veya Personal Access Token
    echo izinlerinizi kontrol edin.
)

echo.
pause
