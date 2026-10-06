from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from datetime import datetime, timedelta
from models.user import LoginRequest, UserResponse

router = APIRouter(tags=["authentication"])

SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Database simulasi lokal untuk memotong kebuntuan database MongoDB yang kosong
MOCK_USERS = {
    "admin": {"username": "admin", "password": "admin123", "role": "administrator", "name": "Kepala Admin"},
    "pengurus": {"username": "pengurus", "password": "pengurus123", "role": "pengurus", "name": "Budi Santoso, S.Pd."}
}

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/login", response_model=UserResponse)
async def login(data: LoginRequest):
    # Cek di database lokal terlebih dahulu
    if data.username in MOCK_USERS:
        user = MOCK_USERS[data.username]
        if user["password"] == data.password:
            token = create_access_token({"sub": user["username"], "role": user["role"]})
            return {
                "token": token,
                "token_type": "bearer",
                "username": user["username"],
                "role": user["role"],
                "name": user["name"]
            }
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Username atau password salah"
    )
