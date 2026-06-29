# GitHub Setup Guide

## 1. Extract and open the project

Extract `StrikePathAI.zip`, then open the extracted `StrikePathAI` folder in VS Code.

Your VS Code Explorer should show:

```text
StrikePathAI
├── apps
│   ├── api
│   └── web
├── docs
├── scripts
├── docker-compose.yml
└── README.md
```

## 2. Create an empty GitHub repository

1. Sign in to GitHub.
2. Select **New repository**.
3. Name it `strikepath-ai`.
4. Choose **Private** while the product is under development.
5. Do not initialize it with a README, `.gitignore`, or license. Those already exist in this project.
6. Create the repository.

## 3. Initialize and push from PowerShell

Run these commands from the extracted project root:

```powershell
cd "C:\path\to\StrikePathAI"
git init
git add .
git commit -m "Initial StrikePath AI MVP"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/strikepath-ai.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username or organization.

## 4. Authentication options

GitHub no longer accepts an account password for Git operations over HTTPS. Use one of these:

- Sign in through the browser prompt shown by Git Credential Manager.
- Use GitHub Desktop and choose **Add an Existing Repository from your Local Drive**.
- Configure SSH and replace the remote with the SSH repository address.

## 5. Normal update workflow

After changing source code:

```powershell
git status
git add .
git commit -m "Describe the change"
git push
```

Railway can automatically redeploy the affected service after each push to `main`.

## 6. Recommended repository settings

Under **Settings → General**:

- Keep the repository private during private development.
- Enable branch protection for `main` once more than one developer contributes.
- Require pull requests and passing checks before merging.

Under **Settings → Security**:

- Enable Dependabot alerts.
- Enable secret scanning if available for the repository plan.
- Never commit `.env` files, Railway secrets, database passwords, or the production JWT secret.

The included `.gitignore` already excludes environment files.
