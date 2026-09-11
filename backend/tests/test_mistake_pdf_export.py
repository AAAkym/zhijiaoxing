from io import BytesIO

from pypdf import PdfReader

from src.services.export_service import generate_pdf


def test_generate_pdf_with_chinese_content_returns_readable_pdf():
    result = generate_pdf(
        [
            {
                "question_content": "\u6d4b\u8bd5\u4e2d\u6587\u9898\u76ee\uff1a\u4e00\u52a0\u4e00\u7b49\u4e8e\u51e0\uff1f",
                "user_answer": "\u4e09",
                "correct_answer": "\u4e8c",
                "mastery_status": "unmastered",
                "ai_analysis": "\u9700\u8981\u590d\u4e60\u57fa\u7840\u52a0\u6cd5\u3002",
            }
        ]
    )

    assert isinstance(result, bytes)
    assert result.startswith(b"%PDF-")
    assert len(PdfReader(BytesIO(result)).pages) >= 1
