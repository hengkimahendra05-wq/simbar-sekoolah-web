from fastapi import APIRouter, Depends, HTTPException, status
from models.user import LoginRequest, UserResponse

router = APIRouter(tags=["authentication"])

# Basis data lokal instan untuk mengamankan login admin
MOCK_USERS = {
    "admin": {"username": "admin", "password": "admin123", "role": "administrator", "name": "Kepala Admin"},
    "pengurus": {"username": "pengurus", "password": "pengurus123", "role": "pengurus", "name": "Budi Santoso, S.Pd."}
}

@router.post("/login", response_model=UserResponse)
async def login(data: LoginRequest):
    if data.username in MOCK_USERS:
        user = MOCK_USERS[data.username]
        if user["password"] == data.password:
            # Membuat token simulasi aman menggunakan teks murni bawaan Python (Tanpa butuh PyJWT / Jose)
            simulated_token = f"simulated_token_for_{user['username']}_role_{user['role']}"
            return {
                "token": simulated_token,
                "token_type": "bearer",
                "username": user["username"],
                "role": user["role"],
                "name": user["name"]
            }
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Username atau password salah"
    )
